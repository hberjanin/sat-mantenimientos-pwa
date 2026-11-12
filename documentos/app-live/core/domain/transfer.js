import { MAX_TRANSFER_BYTES, TRANSFER_FORMAT, TRANSFER_VERSION } from './constants.js?v=1.0.46';
import { normalizeData } from './schema.js?v=1.0.46';

const TECHNICIAN_FIELDS = new Set([
  'technician', 'technicianName', 'technician1Name', 'technician1Signature',
  'technician2Name', 'technician2Signature', 'technicianSignature'
]);

const CLIENT_SIGNATURE_FIELDS = new Set([
  'clientSignature', 'clientSigner', 'clientEmail', 'signedAt', 'clientAbsent', 'absenceReason'
]);

function utf8ByteLength(value) {
  if (typeof TextEncoder === 'function') return new TextEncoder().encode(value).length;
  // Fallback para navegadores antiguos que no implementan TextEncoder.
  try { return unescape(encodeURIComponent(value)).length; } catch { return String(value).length; }
}

function withoutFields(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !fields.has(key)));
}

/**
 * Crea el contrato publico de transferencia. Solo se admite una visita no firmada por
 * el cliente; el dispositivo receptor aporta su tecnico y su firma localmente.
 */
export function createTransferPayload(data, visitId) {
  const source = normalizeData(data);
  const visit = source.visits.find((item) => item.id === visitId);
  if (!visit) throw new Error('La visita no existe');
  const notes = source.notes.filter((item) => item.visitId === visitId && !item.deleted);
  if (notes.some((item) => item.clientSignature || item.clientSigner || item.status === 'signed' || item.status === 'absent' || item.status === 'sent')) {
    throw new Error('No se puede exportar una visita ya firmada por el cliente');
  }
  return {
    format: TRANSFER_FORMAT,
    version: TRANSFER_VERSION,
    exportedAt: new Date().toISOString(),
    visit: withoutFields(visit, TECHNICIAN_FIELDS),
    notes: notes.map((note) => ({
      ...withoutFields(note, new Set([...TECHNICIAN_FIELDS, ...CLIENT_SIGNATURE_FIELDS])),
      status: 'pending',
      deleted: false,
      deletedAt: undefined
    }))
  };
}

export function validateTransferPayload(payload) {
  const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  if (!isPlainObject(payload)) return { ok: false, reason: 'El archivo no contiene un objeto JSON' };
  let serializedSize;
  try { serializedSize = utf8ByteLength(JSON.stringify(payload)); } catch { return { ok: false, reason: 'El archivo no contiene datos JSON válidos' }; }
  if (serializedSize > MAX_TRANSFER_BYTES) return { ok: false, reason: 'El archivo de transferencia es demasiado grande' };
  if (payload.format !== TRANSFER_FORMAT) return { ok: false, reason: 'Formato de transferencia no compatible' };
  if (payload.version !== TRANSFER_VERSION) return { ok: false, reason: 'Version de transferencia no compatible' };
  if (!isPlainObject(payload.visit) || !String(payload.visit.id || '').trim()) return { ok: false, reason: 'Falta la visita' };
  if (!Array.isArray(payload.notes) || payload.notes.length > 256) return { ok: false, reason: 'Faltan las ordenes de la visita o son demasiadas' };
  const visitId = String(payload.visit.id).trim();
  const ids = new Set();
  const unsafe = new Set(['__proto__', 'prototype', 'constructor']);
  const hasUnsafeKeys = (value) => Object.keys(value).some((key) => unsafe.has(key));
  if (hasUnsafeKeys(payload) || hasUnsafeKeys(payload.visit)) return { ok: false, reason: 'El archivo contiene campos no seguros' };
  for (const note of payload.notes) {
    if (!isPlainObject(note) || !String(note.id || '').trim()) return { ok: false, reason: 'Hay una orden sin identificador válido' };
    if (ids.has(String(note.id))) return { ok: false, reason: 'El archivo contiene órdenes duplicadas' };
    ids.add(String(note.id));
    if (note.visitId != null && String(note.visitId).trim() !== visitId) return { ok: false, reason: 'Una orden no pertenece a la visita indicada' };
    if (hasUnsafeKeys(note)) return { ok: false, reason: 'El archivo contiene campos no seguros' };
  }
  if (payload.visit.clientSignature || payload.visit.clientSigner || payload.notes.some((note) => note.clientSignature || note.clientSigner || note.status === 'signed' || note.status === 'absent' || note.status === 'sent')) return { ok: false, reason: 'El archivo contiene una firma del cliente' };
  return { ok: true };
}

export function importTransfer(data, payload, localTechnician = {}) {
  const validation = validateTransferPayload(payload);
  if (!validation.ok) throw new Error(validation.reason);
  const source = normalizeData(data);
  const visit = {
    ...payload.visit,
    technician: localTechnician.name || '',
    status: 'open'
  };
  const notes = payload.notes.map((note) => ({
    ...note,
    visitId: visit.id,
    status: 'pending',
    clientSignature: '',
    clientSigner: '',
    clientEmail: '',
    signedAt: '',
    clientAbsent: false,
    absenceReason: '',
    technician: localTechnician.name || '',
    technician1Name: localTechnician.name || '',
    technician1Signature: localTechnician.signature || '',
    technician2Name: '',
    technician2Signature: ''
  }));
  const visitIndex = source.visits.findIndex((item) => item.id === visit.id);
  if (visitIndex >= 0) source.visits[visitIndex] = visit; else source.visits.unshift(visit);
  source.notes = source.notes.filter((note) => note.visitId !== visit.id);
  source.notes.unshift(...notes);
  return normalizeData(source);
}
