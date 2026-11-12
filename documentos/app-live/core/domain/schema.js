/**
 * Normalizacion de datos persistidos.
 *
 * El navegador puede contener datos de varias generaciones de la aplicacion. La
 * normalizacion es intencionadamente conservadora: completa estructuras que faltan,
 * convierte colecciones invalidas en colecciones vacias y deja intactas las propiedades
 * desconocidas para no perder informacion futura.
 */

import { EMPTY_DATA } from './constants.js?v=1.0.47';

const arrayOr = (value, fallback = []) => Array.isArray(value) ? value : [...fallback];
const stringOrEmpty = (value) => value == null ? '' : String(value);
const canonicalBrand = (value) => {
  const text = stringOrEmpty(value).trim();
  return /^(thermo|thermofisher|bicron)$/i.test(text) ? 'Thermo Fisher Scientific' : text;
};

function uniqueStrings(values) {
  const result = [];
  const seen = new Set();
  for (const value of arrayOr(values)) {
    const text = stringOrEmpty(value).trim();
    const key = text.toLocaleLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function ensureId(prefix, value, index) {
  const text = stringOrEmpty(value).trim();
  return text || `${prefix}-legacy-${index + 1}`;
}

function normalizeClient(client, index) {
  if (typeof client === 'string') {
    const name = client.trim();
    return { id: ensureId('client', '', index), name, city: '', province: '', country: 'España' };
  }
  const value = client && typeof client === 'object' ? client : {};
  return {
    ...value,
    name: stringOrEmpty(value.name).trim(),
    city: stringOrEmpty(value.city).trim(),
    province: stringOrEmpty(value.province).trim(),
    country: stringOrEmpty(value.country).trim() || 'España',
    id: ensureId('client', value.id, index)
  };
}

function normalizeNote(note, index) {
  const value = note && typeof note === 'object' ? note : {};
  const id = ensureId('note', value.id, index);
  const legacyVisitId = `legacy-${id}`;
  return {
    ...value,
    id,
    visitId: stringOrEmpty(value.visitId).trim() || legacyVisitId,
    status: ['pending', 'signed', 'absent', 'sent'].includes(value.status) ? value.status : 'pending',
    deleted: Boolean(value.deleted),
    type: stringOrEmpty(value.type).trim(),
    parts: arrayOr(value.parts),
    params: value.params && typeof value.params === 'object' && !Array.isArray(value.params) ? value.params : {},
    application: arrayOr(value.application),
    asmChecks: arrayOr(value.asmChecks),
    brand: canonicalBrand(value.brand),
    brandOtherInfo: canonicalBrand(value.brandOtherInfo),
    generalChecks: arrayOr(value.generalChecks),
    generateReport: value.generateReport === true || value.generateReport === 'true' || value.generateReport === 'on',
    reportTitle: stringOrEmpty(value.reportTitle).trim(),
    reportFinalizedAt: stringOrEmpty(value.reportFinalizedAt).trim(),
    created: stringOrEmpty(value.created),
    updated: stringOrEmpty(value.updated)
  };
}

function normalizeVisit(visit, index) {
  const value = visit && typeof visit === 'object' ? visit : {};
  return {
    ...value,
    id: ensureId('visit', value.id, index),
    client: stringOrEmpty(value.client).trim(),
    city: stringOrEmpty(value.city).trim(),
    province: stringOrEmpty(value.province).trim(),
    country: stringOrEmpty(value.country).trim() || 'España',
    date: stringOrEmpty(value.date).trim(),
    technician: stringOrEmpty(value.technician).trim(),
    status: value.status === 'closed' ? 'closed' : 'open',
    created: stringOrEmpty(value.created)
  };
}

export function normalizeData(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const result = { ...EMPTY_DATA, ...source };

  // `company` pertenecia a una version antigua y no participa en ningun flujo actual.
  delete result.company;

  result.notes = arrayOr(source.notes).map(normalizeNote);
  result.visits = arrayOr(source.visits).map(normalizeVisit);
  result.trash = arrayOr(source.trash).map(normalizeNote);
  result.visitTrash = arrayOr(source.visitTrash).map((entry, index) => ({
    ...(entry && typeof entry === 'object' ? entry : {}),
    visit: normalizeVisit(entry?.visit, index),
    notes: arrayOr(entry?.notes).map(normalizeNote)
  }));
  result.templates = arrayOr(source.templates).filter((item) => item && typeof item === 'object').map((item, index) => ({
    ...item,
    id: ensureId('template', item.id, index),
    title: stringOrEmpty(item.title).trim(),
    type: stringOrEmpty(item.type).trim(),
    generateReport: Boolean(item.generateReport),
    reportTitle: stringOrEmpty(item.reportTitle).trim() || 'INFORME DE REVISIÓN',
    generalChecks: arrayOr(item.generalChecks).map(String)
  }));
  result.clients = arrayOr(source.clients).map(normalizeClient).filter((client) => client.name);
  result.cities = uniqueStrings(Array.isArray(source.cities) && source.cities.length ? source.cities : EMPTY_DATA.cities);
  result.provinces = uniqueStrings(Array.isArray(source.provinces) && source.provinces.length ? source.provinces : EMPTY_DATA.provinces);
  result.brands = uniqueStrings(uniqueStrings(source.brands).map(canonicalBrand));
  result.models = uniqueStrings(source.models);
  result.modelCatalog = arrayOr(source.modelCatalog).map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;
    return {
      ...entry,
      brand: canonicalBrand(entry.brand),
      brandName: canonicalBrand(entry.brandName)
    };
  });

  for (const key of ['technicianName', 'technicianEmail', 'technicianSignature', 'technician1Name', 'technician1Signature', 'technician2Name', 'technician2Signature', 'reportCity', 'footerLine1', 'footerLine2', 'lastClientSigner', 'lastClientEmail']) {
    result[key] = stringOrEmpty(result[key]);
  }
  return result;
}

export function parseStoredData(raw, onError) {
  try {
    return normalizeData(JSON.parse(raw || '{}'));
  } catch (error) {
    onError?.(error, raw);
    return normalizeData({});
  }
}
