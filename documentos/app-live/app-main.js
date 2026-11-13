import {
  ASM_CHECKS,
  DAY_MS,
  GENERAL_CHECKS,
  INTERVENTION_TYPES,
  STORAGE_KEY
} from './core/domain/constants.js?v=1.0.49';
import {
  formatDate,
  formatDateTime,
  localDateValue,
  localDateTimeValue
} from './core/domain/date-time.js?v=1.0.49';
import { createStore } from './core/domain/store.js?v=1.0.49';
import { createTransferPayload, validateTransferPayload } from './core/domain/transfer.js?v=1.0.49';
import { applyClientOutcome } from './core/domain/signatures.js?v=1.0.49';
import { APP_VERSION_LABEL } from './core/domain/version.js?v=1.0.49';

/**
 * Controlador principal de la SPA.
 *
 * Esta es la unica pieza responsable de montar las vistas, registrar los casos de uso
 * basicos y publicar los puntos de extension que consumen los modulos de firma, PDF,
 * plantillas y transferencia. Los modulos de extension no deben volver a renderizar una
 * pagina completa ni mantener una segunda copia del estado.
 */

function browserStorage() {
  try {
    const storage = window.localStorage;
    // Leer una vez detecta el modo privado o una política que bloquee el acceso.
    storage.getItem('__sat_storage_probe__');
    return storage;
  } catch {
    return {
      getItem: () => null,
      setItem: () => { throw new Error('El almacenamiento local no está disponible'); }
    };
  }
}

const store = createStore(browserStorage(), STORAGE_KEY);
const modal = document.querySelector('#modal');
const main = document.querySelector('#main');
const toastElement = document.querySelector('#toast');
const appVersionElement = document.querySelector('[data-app-version]');
if (appVersionElement) appVersionElement.textContent = APP_VERSION_LABEL;
let toastTimer = 0;
let lastFocusedElement = null;

const uid = () => window.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[character]));
const text = (value) => String(value ?? '').trim();

function notify(message) {
  if (!toastElement) return;
  toastElement.textContent = message;
  toastElement.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastElement.classList.remove('show'), 3000);
}

function navigate(hash) {
  const normalized = hash.startsWith('#') ? hash : `#${hash}`;
  if (location.hash === normalized) render();
  else location.hash = normalized;
}

function closeModal() {
  if (!modal) return;
  modal.hidden = true;
  modal.innerHTML = '';
  lastFocusedElement?.focus?.({ preventScroll: true });
  lastFocusedElement = null;
}

function showModal(content) {
  if (!modal) return;
  lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modal.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true">${content}</div>`;
  modal.hidden = false;
  const card = modal.querySelector('.modal-card');
  card.scrollTop = 0;
  card.tabIndex = -1;
  // Mantiene el foco accesible sin desplazar el diálogo hasta sus botones
  // inferiores en pantallas pequeñas.
  modal.querySelector('[data-close]')?.focus({ preventScroll: true });
}

// Los módulos pequeños de interfaz pueden reutilizar el diálogo accesible de la SPA.
window.showAppModal = showModal;

function confirmAction(title, message, confirmLabel = 'Confirmar') {
  return new Promise((resolve) => {
    showModal(`<h2>${esc(title)}</h2><p>${esc(message)}</p><div class="modal-actions"><button type="button" class="button" data-confirm-no>Cancelar</button><button type="button" class="button danger" data-confirm-yes>${esc(confirmLabel)}</button></div>`);
    const finish = (answer) => { closeModal(); resolve(answer); };
    modal.querySelector('[data-confirm-no]').onclick = () => finish(false);
    modal.querySelector('[data-confirm-yes]').onclick = () => finish(true);
    modal.querySelector('[data-confirm-no]').focus();
  });
}

function shell(title, subtitle = 'Gestion local y segura de notas de intervencion.') {
  return `<div class="page-title"><div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div></div>`;
}

function statusBadge(note) {
  const labels = {
    pending: 'Pendiente de firma',
    signed: 'Firmada',
    absent: 'Cliente ausente',
    sent: 'Enviada'
  };
  return `<span class="badge ${esc(note.status)}">${labels[note.status] || 'Pendiente de firma'}</span>`;
}

function technicianName(data, note, slot = 1) {
  const names = text(note?.technician).split(/\s*\/\s*|\s*;\s*/).filter(Boolean);
  if (slot === 1) return text(note?.technician1Name) || names[0] || text(data.technician1Name) || text(data.technicianName);
  return text(note?.technician2Name) || names[1] || '';
}

function technicianSignature(data, note, slot = 1) {
  if (slot === 1) return text(note?.technician1Signature) || text(data.technician1Signature) || text(data.technicianSignature);
  return text(note?.technician2Signature);
}

function nextTechnicianSlot(data, note) {
  if (!technicianSignature(data, note, 1)) return 1;
  if (technicianName(data, note, 2) && !technicianSignature(data, note, 2)) return 2;
  return 0;
}

function noteSubject(note) {
  const brand = note.brand === 'Otra / no identificada' ? note.brandOtherInfo || note.brand : note.brand;
  return [brand, note.model || note.equipment].filter(Boolean).join(' · ') || 'Equipo sin identificar';
}

function noteTitle(note) {
  const type = note.type === INTERVENTION_TYPES.ASM ? INTERVENTION_TYPES.ASM : 'Nota de intervención';
  return `${type} · ${esc(noteSubject(note))}`;
}

function technicianAction(note, data) {
  if (note.status !== 'pending') return '';
  const slot = nextTechnicianSlot(data, note);
  return slot
    ? `<button class="button small primary" data-sign-technician="${esc(note.id)}" data-technician-slot="${slot}">Firmar ${slot === 1 ? 'técnico' : 'segundo técnico'}</button>`
    : `<button class="button small primary" data-sign-note="${esc(note.id)}">Firma cliente</button>`;
}

function noteCard(note, data) {
  return `<article class="record"><div class="record-main"><div class="record-title">${noteTitle(note)}</div><div class="record-meta">Serie: ${esc(note.serial || 'Sin serie')} · ${esc(formatDate(note.date))}${note.brand ? ` · ${esc(note.brand)}` : ''}</div></div><div class="actions">${statusBadge(note)}<button class="button small" data-open-note="${esc(note.id)}">Abrir</button>${technicianAction(note, data)}</div></article>`;
}

function renderHome(data) {
  const activeNotes = data.notes.filter((note) => !note.deleted);
  const openVisits = data.visits.filter((visit) => visit.status !== 'closed').length;
  const pending = activeNotes.filter((note) => note.status === 'pending').length;
  return `${shell('Resumen')}<section class="grid"><div class="panel"><div class="muted">Visitas abiertas</div><div class="metric">${openVisits}</div></div><div class="panel"><div class="muted">Órdenes pendientes</div><div class="metric">${pending}</div></div><div class="panel"><div class="muted">Órdenes gestionadas</div><div class="metric">${activeNotes.length}</div></div></section><div class="panel v2-space"><div class="section-head"><h2>Acciones</h2><button class="button primary" data-new-visit>Nueva visita</button></div><p class="muted">Una visita puede contener varias órdenes de intervención independientes.</p></div>`;
}

function renderVisitList(data, visits, title) {
  if (!visits.length) return '';
  return `<section class="panel v2-space"><div class="section-head"><h2>${esc(title)}</h2><span class="hint">${visits.length} visita${visits.length === 1 ? '' : 's'}</span></div><div class="record-list">${visits.map((visit) => {
    const notes = data.notes.filter((note) => note.visitId === visit.id && !note.deleted);
    return `<article class="visit-card"><div class="visit-card-head"><div><div class="record-title">${esc(visit.client || 'Cliente sin nombre')} · ${esc(formatDate(visit.date))}</div><div class="record-meta">${esc(visit.city || '')}${visit.province ? ` · ${esc(visit.province)}` : ''} · ${notes.length} orden${notes.length === 1 ? '' : 'es'} · ${visit.status === 'closed' ? 'Cerrada' : 'Abierta'}</div></div><div class="actions"><a class="button small primary" href="#visita/${encodeURIComponent(visit.id)}">Abrir visita</a><button class="button small danger" data-delete-visit="${esc(visit.id)}">Borrar</button></div></div>${notes.length ? `<div class="visit-orders"><div class="hint">Órdenes de esta visita</div>${notes.map((note) => noteCard(note, data)).join('')}</div>` : '<div class="hint visit-empty">Todavía no hay órdenes en esta visita.</div>'}</article>`;
  }).join('')}</div></section>`;
}

function renderHistory(data) {
  const open = data.visits.filter((visit) => visit.status !== 'closed');
  const closed = data.visits.filter((visit) => visit.status === 'closed');
  const legacy = data.notes.filter((note) => !note.deleted && !data.visits.some((visit) => visit.id === note.visitId));
  return `${shell('Historial')}<div class="panel"><div class="filterbar"><input id="q" placeholder="Buscar cliente, serie o equipo" aria-label="Buscar"><input id="from" type="date" aria-label="Desde"><input id="to" type="date" aria-label="Hasta"></div></div><div id="history-results" class="v2-stack">${renderVisitList(data, open, 'Visitas abiertas')}${renderVisitList(data, closed, 'Visitas cerradas')}${legacy.length ? `<section class="panel v2-space"><div class="section-head"><h2>Órdenes sin visita</h2></div><div class="record-list">${legacy.map((note) => noteCard(note, data)).join('')}</div></section>` : ''}</div>`;
}

function renderVisit(data, visitId) {
  const visit = data.visits.find((item) => item.id === visitId);
  if (!visit) return '';
  const notes = data.notes.filter((note) => note.visitId === visitId && !note.deleted);
  const complete = notes.length > 0 && notes.every((note) => ['signed', 'absent', 'sent'].includes(note.status));
  return `${shell(`Visita · ${visit.client}`, `${formatDate(visit.date)} · ${visit.status === 'closed' ? 'Cerrada' : 'Abierta'}`)}<div class="toolbar"><button class="button" data-back-history>Volver al historial</button>${visit.status !== 'closed' ? `<a class="button primary" href="#orden/${encodeURIComponent(visit.id)}">Nueva orden de intervención</a><button class="button dark" data-close-visit="${esc(visit.id)}" ${complete ? '' : 'disabled'}>Cerrar visita</button>` : ''}<button class="button danger" data-delete-visit="${esc(visit.id)}">Borrar visita</button></div><div class="visit-summary panel"><div><b>Cliente</b><span>${esc(visit.client)}</span></div><div><b>Ubicación</b><span>${esc(visit.city)}${visit.province ? ` · ${esc(visit.province)}` : ''} · ${esc(visit.country)}</span></div><div><b>Técnico</b><span>${esc(visit.technician || technicianName(data, null))}</span></div><div><b>Observaciones</b><span>${esc(visit.observations || 'Sin observaciones')}</span></div></div><section class="panel v2-space"><div class="section-head"><h2>Notas de intervención</h2><span class="hint">${notes.length} orden${notes.length === 1 ? '' : 'es'}</span></div>${notes.length ? `<div class="record-list">${notes.map((note) => noteCard(note, data)).join('')}</div>` : '<div class="empty">Todavía no hay órdenes en esta visita.</div>'}</section>`;
}

function renderNewVisitPage(data) {
  return `${shell('Nueva visita', 'Información común de la visita')}<form id="visit-page-form" class="panel form-grid"><div class="field full"><label for="visit-client">Cliente *</label><input id="visit-client" name="client" required list="visit-clients"><datalist id="visit-clients">${data.clients.map((client) => `<option value="${esc(client.name)}"></option>`).join('')}</datalist></div><div class="field"><label for="visit-city">Ciudad</label><input id="visit-city" name="city" list="visit-cities"><datalist id="visit-cities">${data.cities.map((city) => `<option value="${esc(city)}"></option>`).join('')}</datalist></div><div class="field"><label for="visit-province">Provincia</label><select id="visit-province" name="province"><option value="">Seleccionar</option>${data.provinces.map((province) => `<option value="${esc(province)}">${esc(province)}</option>`).join('')}</select></div><div class="field"><label for="visit-country">País</label><input id="visit-country" name="country" value="España"></div><div class="field"><label for="visit-date">Fecha *</label><input id="visit-date" name="date" type="date" value="${localDateValue()}" required></div><div class="field"><label for="visit-technician">Técnico</label><input id="visit-technician" name="technician" value="${esc(technicianName(data, null))}"></div><div class="field full"><label for="visit-observations">Observaciones generales</label><textarea id="visit-observations" name="observations"></textarea></div><div class="modal-actions full"><a class="button" href="#historial">Cancelar</a><button class="button primary">Guardar visita</button></div></form>`;
}

function renderOrder(data, visitId) {
  const visit = data.visits.find((item) => item.id === visitId) || {};
  const initialDateTime = localDateTimeValue();
  return `${shell('Nueva orden de intervención', 'Completa el formulario correspondiente y guárdalo pendiente de firma.')}<form id="order-form" class="v2-form"><input type="hidden" name="visitId" value="${esc(visitId)}"><div class="panel"><div class="section-head"><h2>Datos comunes</h2><span class="hint">Los checks son interactivos</span></div><div class="form-grid"><div class="field"><label for="order-type">Tipo de intervención *</label><select id="order-type" name="type" required><option value="${esc(INTERVENTION_TYPES.ASM)}">${esc(INTERVENTION_TYPES.ASM)}</option><option value="${esc(INTERVENTION_TYPES.GENERAL)}" selected>${esc(INTERVENTION_TYPES.GENERAL)}</option></select></div><div class="field"><label for="order-client">Cliente *</label><input id="order-client" name="client" required list="order-clients" value="${esc(visit.client || '')}"><datalist id="order-clients">${data.clients.map((client) => `<option value="${esc(client.name)}"></option>`).join('')}</datalist></div><div class="field"><label for="order-city">Ciudad</label><input id="order-city" name="city" list="order-cities" value="${esc(visit.city || '')}"><datalist id="order-cities">${data.cities.map((city) => `<option value="${esc(city)}"></option>`).join('')}</datalist></div><div class="field"><label for="order-province">Provincia</label><select id="order-province" name="province"><option value="">Seleccionar</option>${data.provinces.map((province) => `<option value="${esc(province)}" ${province === visit.province ? 'selected' : ''}>${esc(province)}</option>`).join('')}</select></div><div class="field"><label for="order-country">País</label><input id="order-country" name="country" value="${esc(visit.country || 'España')}"></div><div class="field"><label for="order-date">Fecha *</label><input id="order-date" name="date" type="date" value="${localDateValue()}" required></div><div class="field"><label for="order-brand">Marca</label><input id="order-brand" name="brand" list="brands" value=""><datalist id="brands">${data.brands.map((brand) => `<option value="${esc(brand)}"></option>`).join('')}</datalist></div><div class="field"><label for="order-model">Modelo *</label><input id="order-model" name="model" required list="models" value=""><datalist id="models">${data.models.map((model) => `<option value="${esc(model)}"></option>`).join('')}</datalist></div><div class="field"><label for="order-serial">Número de serie *</label><input id="order-serial" name="serial" required></div></div></div><div id="type-fields"></div><div class="sticky-actions"><button type="button" class="button" data-back-history>Cancelar</button><button type="submit" class="button primary">Guardar pendiente de firma</button></div><input type="hidden" name="initialDateTime" value="${initialDateTime}"></form>`;
}

const PARAMETER_COLUMNS = ['A / A1 / 1', 'B / A2 / 3', 'C / B1 / 2', 'B2 / 4', 'C1 / 5', 'C2 / 6', 'B1 / 7', 'B2 / 8', 'E1', 'E2', 'F1', 'F2', 'G1', 'G2', 'H1', 'H2'];
const PARAMETER_ROWS = ['Alta tensión', 'Fondo', 'Alarma de nivel 1', 'Alarma de nivel 2', 'Alarma de nivel 3', 'Alarma por fondo', 'Alarma por cuentas altas', 'Alarma por cuentas bajas', 'Valor de sigma por detector'];

function partsFields() {
  return `<div class="field v2-space"><label>Piezas utilizadas</label><div class="wide-table"><table class="data-table"><thead><tr><th>Nº</th><th>PN</th><th>Descripción</th><th>SN</th></tr></thead><tbody>${[1, 2, 3, 4, 5].map((index) => `<tr><th>${index}</th><td><input name="pn${index}"></td><td><input name="ident${index}"></td><td><input name="sn${index}"></td></tr>`).join('')}</tbody></table></div></div>`;
}

function interventionFields(data) {
  const initial = localDateTimeValue();
  return `<div class="field v2-space"><label>Datos de la intervención</label><div class="form-grid inset"><div class="field"><label for="order-technician">Técnico habitual *</label><input id="order-technician" name="technician" required value="${esc(technicianName(data, null))}"></div><div class="field"><label for="notice-time">Fecha y hora de aviso *</label><input id="notice-time" name="noticeTime" type="datetime-local" required value="${initial}"></div><div class="field"><label for="start-time">Fecha y hora de inicio *</label><input id="start-time" name="startTime" type="datetime-local" required value="${initial}"></div><div class="field"><label for="end-time">Fecha y hora de fin</label><input id="end-time" name="endTime" type="datetime-local"></div><div class="field"><label for="total-hours">Total horas de trabajo</label><input id="total-hours" name="totalHours"></div><div class="field"><label for="travel">Desplazamiento</label><input id="travel" name="travel"></div><div class="field full optional-second-technician"><button type="button" class="button small" data-add-second-tech>Añadir segundo técnico</button><div class="field full" data-second-tech-fields hidden><label for="second-technician">Segundo técnico (opcional)</label><input id="second-technician" name="technician2Name" disabled></div></div></div></div>`;
}

function generalFields(data) {
  return `<div class="panel"><h2>Tipo de intervención</h2><div class="check-grid">${GENERAL_CHECKS.map((label, index) => `<label class="check"><input type="checkbox" name="generalCheck${index}"> ${esc(label)}</label>`).join('')}</div><div class="field v2-space"><label for="incident">Incidencia comunicada o detectada *</label><textarea id="incident" name="incident" required></textarea></div><div class="field v2-space"><label for="work">Trabajos realizados *</label><textarea id="work" name="work" required></textarea></div>${partsFields()}<div class="field v2-space"><label for="general-notes">Notas</label><textarea id="general-notes" name="notes"></textarea></div>${interventionFields(data)}</div>`;
}

function asmParameterFields() {
  return `<div class="field v2-space"><label>Parámetros</label><div class="wide-table"><table class="data-table asm-table"><thead><tr><th>Parámetro</th>${PARAMETER_COLUMNS.map((column) => `<th>${esc(column)}</th>`).join('')}</tr></thead><tbody>${PARAMETER_ROWS.map((row, rowIndex) => `<tr><th>${esc(row)}</th>${PARAMETER_COLUMNS.map((_, columnIndex) => `<td><input name="param_${rowIndex}_${columnIndex}"></td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
}

function sensorFields(prefix) {
  return `<b>Presente</b><label class="check"><input type="checkbox" name="${prefix}PresentYes"> Sí</label><label class="check"><input type="checkbox" name="${prefix}PresentNo"> No</label><b>Funcionando</b><label class="check"><input type="checkbox" name="${prefix}WorkingYes"> Sí</label><label class="check"><input type="checkbox" name="${prefix}WorkingNo"> No</label>`;
}

function asmFields(data) {
  return `<div class="panel"><h2>Datos ASM</h2><div class="form-grid"><div class="field full"><label>Aplicación del detector</label><div class="check-grid">${['Camión', 'Tren', 'Cesta', 'Cinta', 'Otro'].map((label, index) => `<label class="check"><input type="checkbox" name="application${index}"> ${esc(label)}</label>`).join('')}</div></div><div class="field full"><label>Incidencia comunicada o detectada antes del mantenimiento</label><div class="check-grid"><label class="check"><input type="checkbox" name="asmIncidentYes"> Sí</label><label class="check"><input type="checkbox" name="asmIncidentNo"> No</label></div><div id="asm-incident-explanation" class="field v2-space" hidden><label for="asm-incident-text">Explicación de la incidencia comunicada o detectada *</label><textarea id="asm-incident-text" name="asmIncidentExplanation"></textarea></div></div></div>${asmParameterFields()}<div class="field v2-space"><label>Comprobaciones</label><div class="check-grid">${ASM_CHECKS.map((label, index) => `<div class="inset"><b>${esc(label)}</b><label class="check"><input type="checkbox" name="asmCheck${index}Yes"> Sí</label><label class="check"><input type="checkbox" name="asmCheck${index}No"> No</label><label class="check"><input type="checkbox" name="asmCheck${index}NA"> No aplica</label></div>`).join('')}</div><div class="form-grid v2-space"><div class="field"><label>Tensión 1 [voltios]</label><input name="voltage1"></div><div class="field"><label>Tensión 2 [voltios]</label><input name="voltage2"></div><div class="field"><label>Tensión 3 [voltios]</label><input name="voltage3"></div><div class="field"><label>Tensión umbral [milivoltios]</label><input name="threshold"></div><div class="field" data-asm-frequency><label>Frecuencia de vigilancia [hercios]</label><input name="frequency"></div></div><div class="sensor-grid"><div class="panel inset"><h3>Sensor 1</h3>${sensorFields('s1')}</div><div class="panel inset"><h3>Sensor 2</h3>${sensorFields('s2')}</div></div></div><div class="field v2-space" data-asmiv-fields hidden><label>Datos específicos ASM IV</label><div class="form-grid inset"><div class="field"><label for="asmiv-software-version">Versión de software</label><input id="asmiv-software-version" name="softwareVersion"></div><div class="field"><label for="asmiv-ssd-usage">Uso de SSD</label><input id="asmiv-ssd-usage" name="ssdUsage"></div><div class="field"><label for="asmiv-cf-usage">Uso de CF</label><input id="asmiv-cf-usage" name="cfUsage"></div></div><div class="field v2-space"><label>Niveles de alarma ASM IV</label><div class="check-grid three"><div class="inset"><b>Nivel 1</b><label class="check"><input type="checkbox" name="level1Concurrent"> Concurrente</label><label class="check"><input type="checkbox" name="level1PostProcessing"> Post-Processing</label></div><div class="inset"><b>Nivel 2</b><label class="check"><input type="checkbox" name="level2Concurrent"> Concurrente</label><label class="check"><input type="checkbox" name="level2PostProcessing"> Post-Processing</label></div><div class="inset"><b>Nivel 3</b><label class="check"><input type="checkbox" name="level3Concurrent"> Concurrente</label><label class="check"><input type="checkbox" name="level3PostProcessing"> Post-Processing</label></div></div></div></div><div class="field v2-space"><label for="asm-notes">Notas</label><textarea id="asm-notes" name="notes"></textarea></div>${interventionFields(data)}</div>`;
}

function formatStorageBytes(value) {
  if (!Number.isFinite(value)) return '';
  if (value < 1024) return `${Math.round(value)} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function storageStatusText() {
  const current = store.getStatus?.() || {};
  if (!current.durableReady) return 'Almacenamiento compatible: localStorage. Se recomienda exportar copias periódicas.';
  const usage = formatStorageBytes(current.usage);
  const quota = formatStorageBytes(current.quota);
  const space = usage && quota ? ` · Uso ${usage} de ${quota}` : '';
  const persistence = current.persistentStorage ? 'persistencia solicitada' : 'persistencia del navegador no garantizada';
  return `Almacenamiento durable: IndexedDB (${persistence})${space}. Los informes finales se archivan localmente.`;
}

function settings(data) {
  const catalog = (key, label, values) => `<div class="catalog-block catalog-${esc(key)}"><h3>${esc(label)}</h3><div class="actions"><input id="add-${esc(key)}" placeholder="Añadir"><button class="button small" data-add="${esc(key)}">Añadir</button></div><div class="mini-list">${values.map((value, index) => `<div><span title="${esc(value)}">${esc(value)}</span><button class="button small danger" data-remove="${esc(key)}" data-index="${index}" aria-label="Eliminar ${esc(value)}">Eliminar</button></div>`).join('') || '<span class="muted">Sin registros</span>'}</div></div>`;
  return `${shell('Configuración')}<div class="two-col"><div><div class="panel"><h2>Perfil y firma</h2><div class="form-grid"><div class="field full"><label for="set-email">Correo del técnico</label><input id="set-email" type="email" value="${esc(data.technicianEmail)}"></div><div class="field full"><label for="set-report-city">Ciudad de firma en los informes</label><input id="set-report-city" autocomplete="address-level2" value="${esc(data.reportCity || 'Madrid')}" placeholder="Madrid"><span id="report-location-status" class="hint" role="status" aria-live="polite"></span></div></div><button class="button primary v2-space" data-save-settings>Guardar</button></div><div class="panel v2-space"><h2>Catálogos</h2>${catalog('client', 'Clientes', data.clients.map((client) => client.name))}${catalog('city', 'Ciudades', data.cities)}${catalog('brand', 'Marcas', data.brands)}${catalog('model', 'Modelos', data.models)}</div></div><div class="panel"><h2>Datos</h2><p class="hint" data-storage-status role="status">${esc(storageStatusText())}</p><p class="hint">Exporta una copia JSON para respaldo. La importación sustituye los datos locales.</p><div class="actions"><button class="button" data-export>Exportar copia</button><label class="button" for="import-data">Importar copia</label><input id="import-data" type="file" accept="application/json" hidden></div><section class="pwa-management" aria-labelledby="pwa-management-title"><h3 id="pwa-management-title">Aplicación</h3><p class="hint" data-pwa-status role="status" aria-live="polite">Comprobando disponibilidad de instalación...</p><div class="actions"><button type="button" class="button" data-install-pwa>Instalar aplicación</button><button type="button" class="button danger" data-uninstall-pwa>Desinstalar aplicación</button></div><p class="hint" data-pwa-update-status role="status" aria-live="polite">Comprobando actualizaciones...</p><button type="button" class="button" data-update-pwa>Buscar e instalar actualización</button></section></div></div>`;
}

function renderTrash(data) {
  const cutoff = Date.now() - (30 * DAY_MS);
  const current = {
    ...data,
    trash: data.trash.filter((item) => new Date(item.deletedAt || 0).getTime() > cutoff),
    visitTrash: data.visitTrash.filter((item) => new Date(item.deletedAt || 0).getTime() > cutoff)
  };
  if (current.trash.length !== data.trash.length || current.visitTrash.length !== data.visitTrash.length) store.write(current);
  const noteRows = current.trash.map((note) => `<article class="record"><div><div class="record-title">${noteTitle(note)}</div><div class="record-meta">Eliminada ${esc(formatDate(note.deletedAt))}</div></div><button class="button small" data-restore-note="${esc(note.id)}">Restaurar</button></article>`).join('');
  const visitRows = current.visitTrash.map((entry) => `<article class="record"><div><div class="record-title">${esc(entry.visit.client)}</div><div class="record-meta">${esc(formatDate(entry.deletedAt))} · ${entry.notes.length} órdenes</div></div><button class="button small" data-restore-visit="${esc(entry.visit.id)}">Restaurar</button></article>`).join('');
  return `${shell('Papelera', 'Los elementos se conservan durante 30 días.')}<div class="panel"><h2>Órdenes eliminadas</h2>${noteRows || '<div class="empty">No hay órdenes eliminadas.</div>'}</div><div class="panel v2-space"><h2>Visitas eliminadas</h2>${visitRows || '<div class="empty">No hay visitas eliminadas.</div>'}</div>`;
}

function typeFields(data, type) {
  return type === INTERVENTION_TYPES.ASM ? asmFields(data) : generalFields(data);
}

function createVisit(form) {
  const values = Object.fromEntries(new FormData(form).entries());
  const visit = { id: uid(), ...values, status: 'open', created: new Date().toISOString() };
  store.update((data) => {
    data.visits.unshift(visit);
    ensureClientAndCity(data, visit);
    return data;
  });
  return visit;
}

function ensureClientAndCity(data, values) {
  const name = text(values.client);
  if (name && !data.clients.some((client) => text(client.name).toLocaleLowerCase() === name.toLocaleLowerCase())) {
    data.clients.push({ name, city: text(values.city), province: text(values.province), country: text(values.country) || 'España' });
  }
  const city = text(values.city);
  if (city && !data.cities.some((item) => item.toLocaleLowerCase() === city.toLocaleLowerCase())) data.cities.push(city);
}

function saveOrder(form) {
  const values = Object.fromEntries(new FormData(form).entries());
  const required = ['client', 'model', 'serial', 'date', 'noticeTime', 'technician', 'startTime'];
  if (required.some((key) => !text(values[key]))) {
    notify('Completa cliente, modelo, serie, fecha, horas y técnicos');
    return;
  }
  if (values.type === INTERVENTION_TYPES.GENERAL && (!text(values.incident) || !text(values.work))) {
    notify('Completa la incidencia y los trabajos realizados');
    return;
  }
  if (values.type === INTERVENTION_TYPES.ASM && values.asmIncidentYes === 'on' && !text(values.asmIncidentExplanation)) {
    notify('Explica la incidencia antes de guardar la orden');
    return;
  }
  const visitId = text(values.visitId) || `legacy-${uid()}`;
  const parts = [1, 2, 3, 4, 5].map((index) => ({ pn: text(values[`pn${index}`]), ident: text(values[`ident${index}`]), sn: text(values[`sn${index}`]) })).filter((part) => part.pn || part.ident || part.sn);
  const params = Object.fromEntries(Object.entries(values).filter(([key, value]) => key.startsWith('param_') && text(value)).map(([key, value]) => [key.slice(6), value]));
  const note = {
    ...values,
    id: uid(),
    visitId,
    status: 'pending',
    deleted: false,
    parts,
    params,
    application: Object.keys(values).filter((key) => /^application\d+$/.test(key)).map((key) => key.slice(11)),
    asmChecks: Object.keys(values).filter((key) => /^asmCheck\d+(Yes|No|NA)$/.test(key)).map((key) => key.slice(8)),
    generalChecks: Object.keys(values).filter((key) => /^generalCheck\d+$/.test(key)).map((key) => key.slice(12)),
    equipment: values.model,
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };
  store.update((data) => {
    data.notes.unshift(note);
    let visit = data.visits.find((item) => item.id === visitId);
    if (!visit) {
      visit = { id: visitId, client: text(values.client), city: text(values.city), province: text(values.province), country: text(values.country) || 'España', date: text(values.date), technician: text(values.technician), status: 'open', created: new Date().toISOString() };
      data.visits.unshift(visit);
    }
    ensureClientAndCity(data, values);
    const customBrand = text(values.brandOtherInfo);
    if (values.brand === 'Otra / no identificada' && customBrand && !data.brands.some((brand) => brand.toLocaleLowerCase() === customBrand.toLocaleLowerCase())) data.brands.push(customBrand);
    return data;
  });
  notify('Orden guardada pendiente de firma');
  navigate(`visita/${encodeURIComponent(visitId)}`);
}

async function deleteNote(id) {
  const data = store.read();
  const note = data.notes.find((item) => item.id === id);
  if (!note || !(await confirmAction('Eliminar orden de intervención', 'La orden se moverá a la papelera durante 30 días.', 'Mover a papelera'))) return;
  store.update((current) => {
    const target = current.notes.find((item) => item.id === id);
    if (!target) return current;
    target.deleted = true;
    target.deletedAt = new Date().toISOString();
    current.trash.unshift(target);
    current.notes = current.notes.filter((item) => item.id !== id);
    return current;
  });
  closeModal();
  notify('Orden movida a la papelera');
  render();
}

async function deleteVisit(id) {
  const data = store.read();
  const visit = data.visits.find((item) => item.id === id);
  if (!visit || !(await confirmAction('Eliminar visita', 'La visita y todas sus órdenes se moverán a la papelera durante 30 días.', 'Mover a papelera'))) return;
  store.update((current) => {
    const notes = current.notes.filter((note) => note.visitId === id && !note.deleted);
    const deletedAt = new Date().toISOString();
    notes.forEach((note) => { note.deleted = true; note.deletedAt = deletedAt; });
    current.visitTrash.unshift({ visit, notes, deletedAt });
    current.trash.push(...notes);
    current.notes = current.notes.filter((note) => note.visitId !== id);
    current.visits = current.visits.filter((item) => item.id !== id);
    return current;
  });
  notify('Visita movida a la papelera');
  navigate('historial');
}

async function closeVisit(id) {
  const data = store.read();
  const notes = data.notes.filter((note) => note.visitId === id && !note.deleted);
  if (!notes.length || !notes.every((note) => ['signed', 'absent', 'sent'].includes(note.status))) {
    notify('Todas las órdenes deben estar firmadas o marcadas como cliente ausente');
    return;
  }
  if (!(await confirmAction('Cerrar visita', 'Después de cerrarla no se podrán añadir nuevas órdenes.', 'Cerrar visita'))) return;
  store.update((current) => {
    const visit = current.visits.find((item) => item.id === id);
    if (visit) { visit.status = 'closed'; visit.closedAt = new Date().toISOString(); }
    return current;
  });
  notify('Visita cerrada');
  render();
}

function restoreNote(id) {
  store.update((data) => {
    const index = data.trash.findIndex((item) => item.id === id);
    if (index < 0) return data;
    const note = data.trash.splice(index, 1)[0];
    note.deleted = false;
    delete note.deletedAt;
    data.notes.unshift(note);
    return data;
  });
  render();
}

function restoreVisit(id) {
  store.update((data) => {
    const index = data.visitTrash.findIndex((entry) => entry.visit.id === id);
    if (index < 0) return data;
    const entry = data.visitTrash.splice(index, 1)[0];
    entry.visit.status = 'open';
    data.visits.unshift(entry.visit);
    for (const note of entry.notes) {
      note.deleted = false;
      delete note.deletedAt;
      data.notes.unshift(note);
    }
    data.trash = data.trash.filter((note) => !entry.notes.some((restored) => restored.id === note.id));
    return data;
  });
  render();
}

function openNote(id) {
  const data = store.read();
  const note = data.notes.find((item) => item.id === id);
  if (!note) return;
  const asmExplanation = note.type === INTERVENTION_TYPES.ASM && note.asmIncidentYes === 'on' ? `<b>Explicación de la incidencia</b><p>${esc(note.asmIncidentExplanation || 'Sin explicación')}</p>` : '';
  showModal(`<h2>${noteTitle(note)}</h2><p class="muted">${esc(note.client)} · Serie ${esc(note.serial)} · ${esc(formatDate(note.date))}</p><div class="note-preview"><b>Incidencia comunicada o detectada</b><p>${esc(note.incident || 'Sin texto')}</p>${asmExplanation}<b>Trabajos realizados</b><p>${esc(note.work || 'Sin texto')}</p><b>Notas</b><p>${esc(note.notes || 'Sin texto')}</p><b>Estado</b><p>${statusBadge(note)}</p></div><div class="modal-actions">${note.status === 'pending' ? `<button class="button primary" data-sign-note="${esc(note.id)}">Firmar</button>` : ''}<button class="button danger" data-delete-note="${esc(note.id)}">Eliminar</button><button class="button" data-close>Cerrar</button></div>`);
}

/** Canvas comun para las dos firmas que se dibujan dentro de la aplicacion. */
function createSignaturePad(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(280, Math.round(canvas.getBoundingClientRect().width || 480));
  const height = 180;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = '100%';
  canvas.style.height = `${height}px`;
  canvas.style.background = '#fff';
  canvas.style.touchAction = 'none';
  const context = canvas.getContext('2d');
  context.scale(ratio, ratio);
  context.lineWidth = 2;
  context.lineCap = 'round';
  context.strokeStyle = '#202020';
  let drawing = false;
  let dirty = false;
  let lastPoint = null;
  const point = (event) => {
    const rectangle = canvas.getBoundingClientRect();
    return { x: event.clientX - rectangle.left, y: event.clientY - rectangle.top };
  };
  const stop = () => { drawing = false; lastPoint = null; };
  canvas.addEventListener('pointerdown', (event) => {
    drawing = true;
    dirty = true;
    lastPoint = point(event);
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drawing || !lastPoint) return;
    const next = point(event);
    context.beginPath();
    context.moveTo(lastPoint.x, lastPoint.y);
    context.lineTo(next.x, next.y);
    context.stroke();
    lastPoint = next;
  });
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  return {
    get hasInk() { return dirty; },
    get value() { return dirty ? canvas.toDataURL('image/png') : ''; },
    clear() { context.clearRect(0, 0, width, height); dirty = false; }
  };
}

function clientSignModal(id) {
  const data = store.read();
  const note = data.notes.find((item) => item.id === id);
  if (!note || note.status !== 'pending') return;
  showModal(`<h2>Firma del cliente</h2><p>${noteTitle(note)} · ${esc(note.serial)}</p><p class="signature-instructions">Dibuja la firma dentro del recuadro y después pulsa Confirmar.</p><div class="signature-box"><canvas id="client-sign" aria-label="Firma del cliente"></canvas></div><div class="actions v2-space"><button class="button small" type="button" data-clear-sign>Borrar firma</button></div><form id="sign-form" class="form-grid" novalidate><div class="field full"><label class="check"><input type="checkbox" name="absent"> Cliente ausente</label></div><div class="field full"><label for="signer">Nombre del cliente o firmante</label><input id="signer" name="signer" value="${esc(data.lastClientSigner)}"></div><div class="field full"><label for="signer-email">Correo del cliente</label><input id="signer-email" name="email" type="email" value="${esc(data.lastClientEmail)}"></div><div class="field full"><label for="absence-reason">Motivo si está ausente</label><textarea id="absence-reason" name="absenceReason"></textarea></div><div class="modal-actions signature-actions full"><button type="button" class="button" data-close>Cancelar</button><button type="submit" class="button primary" id="confirm-sign" disabled>Confirmar</button></div></form>`);
  const canvas = modal.querySelector('#client-sign');
  const pad = createSignaturePad(canvas);
  const confirm = modal.querySelector('#confirm-sign');
  const absent = modal.querySelector('[name="absent"]');
  const reason = modal.querySelector('[name="absenceReason"]');
  const form = modal.querySelector('#sign-form');
  const updateConfirm = () => {
    const canSign = !absent.checked && pad.hasInk;
    const canRegisterAbsence = absent.checked && Boolean(reason.value.trim());
    confirm.disabled = !(canSign || canRegisterAbsence);
    confirm.setAttribute('aria-disabled', String(confirm.disabled));
  };
  // El canvas no cambia un input HTML convencional: avisamos al formulario
  // cuando empieza un trazo para habilitar Confirmar inmediatamente.
  canvas.addEventListener('pointerdown', updateConfirm);
  canvas.addEventListener('pointerup', updateConfirm);
  canvas.addEventListener('pointercancel', updateConfirm);
  modal.querySelector('[data-clear-sign]').onclick = () => { pad.clear(); updateConfirm(); };
  absent.addEventListener('change', updateConfirm);
  reason.addEventListener('input', updateConfirm);
  form.onsubmit = (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target).entries());
    const isAbsent = values.absent === 'on';
    try {
      const saved = store.update((current) => {
        const target = current.notes.find((item) => item.id === id);
        if (!target) return current;
        const updated = applyClientOutcome(target, { ...values, absent: isAbsent }, pad.value);
        current.notes[current.notes.indexOf(target)] = updated;
        current.lastClientSigner = updated.clientSigner;
        current.lastClientEmail = updated.clientEmail;
        return current;
      });
      window.dispatchEvent(new CustomEvent('client-signature-completed', { detail: { noteId: id, note: saved.notes.find((item) => item.id === id) } }));
    } catch (error) { notify(error.message); return; }
    closeModal();
    notify(isAbsent ? 'Intervención registrada como cliente ausente' : 'Firma guardada y orden bloqueada');
    render();
  };
  updateConfirm();
}

function batchReview(note) {
  const applications = ['Camión', 'Tren', 'Cesta', 'Cinta', 'Otro'].filter((_, index) => note.application?.map(String).includes(String(index)));
  const checks = GENERAL_CHECKS.filter((_, index) => note.generalChecks?.map(String).includes(String(index)));
  const parts = (note.parts || []).map((part) => `${esc(part.pn)} · ${esc(part.ident)} · SN ${esc(part.sn)}`).join('<br>');
  return `<div class="note-preview batch-review"><b>Cliente y equipo</b><p>${esc(note.client)} · ${esc(note.model || note.equipment)} · Serie ${esc(note.serial)}</p><b>Tipo de intervención</b><p>${esc(note.type)}</p><b>Incidencia comunicada o detectada</b><p>${esc(note.incident || (note.asmIncidentYes === 'on' ? 'Sí' : 'No'))}</p>${note.asmIncidentYes === 'on' ? `<b>Explicación de la incidencia</b><p>${esc(note.asmIncidentExplanation || 'Sin explicación')}</p>` : ''}${note.type !== INTERVENTION_TYPES.ASM ? `<b>Trabajos realizados</b><p>${esc(note.work || 'Sin texto')}</p><b>Tipo marcado</b><p>${esc(checks.join(', ') || 'No indicado')}</p>` : `<b>Aplicación del detector</b><p>${esc(applications.join(', ') || 'No indicada')}</p>`}${parts ? `<b>Piezas utilizadas</b><p>${parts}</p>` : ''}<b>Notas</b><p>${esc(note.notes || 'Sin texto')}</p><b>Datos de la intervención</b><p>Técnico: ${esc(note.technician || '')} · Aviso: ${esc(formatDateTime(note.noticeTime))} · Inicio: ${esc(formatDateTime(note.startTime))} · Fin: ${esc(formatDateTime(note.endTime))}</p></div>`;
}

function startBatchSigning(visitId) {
  const ids = store.read().notes.filter((note) => note.visitId === visitId && !note.deleted && note.status === 'pending').map((note) => note.id);
  if (!ids.length) { notify('No hay órdenes pendientes de firma en esta visita'); return; }
  batchSignModal(ids, 0);
}

function batchSignModal(ids, index) {
  const data = store.read();
  const note = data.notes.find((item) => item.id === ids[index]);
  if (!note) return;
  showModal(`<h2>Firma conjunta de la visita</h2><p class="muted">Orden ${index + 1} de ${ids.length} · Lee el documento completo antes de firmarlo.</p>${batchReview(note)}<p class="signature-instructions">Dibuja la firma dentro del recuadro y después pulsa Confirmar esta firma.</p><div class="signature-box"><canvas id="client-sign" aria-label="Firma del cliente"></canvas></div><div class="actions v2-space"><button class="button small" type="button" data-clear-sign>Borrar firma</button></div><form id="sign-form" class="form-grid" novalidate><div class="field full"><label class="check"><input type="checkbox" name="absent"> Cliente ausente</label></div><div class="field full"><label for="batch-signer">Nombre del cliente o firmante</label><input id="batch-signer" name="signer" value="${esc(data.lastClientSigner)}"></div><div class="field full"><label for="batch-email">Correo del cliente</label><input id="batch-email" name="email" type="email" value="${esc(data.lastClientEmail)}"></div><div class="field full"><label for="batch-reason">Motivo si está ausente</label><textarea id="batch-reason" name="absenceReason"></textarea></div><div class="modal-actions signature-actions full"><button type="button" class="button" data-close>Cancelar proceso</button><button type="submit" class="button primary" id="confirm-sign" disabled>Confirmar esta firma</button></div></form>`);
  const canvas = modal.querySelector('#client-sign');
  const pad = createSignaturePad(canvas);
  const confirm = modal.querySelector('#confirm-sign');
  const absent = modal.querySelector('[name="absent"]');
  const reason = modal.querySelector('[name="absenceReason"]');
  const form = modal.querySelector('#sign-form');
  const updateConfirm = () => {
    const canSign = !absent.checked && pad.hasInk;
    const canRegisterAbsence = absent.checked && Boolean(reason.value.trim());
    confirm.disabled = !(canSign || canRegisterAbsence);
    confirm.setAttribute('aria-disabled', String(confirm.disabled));
  };
  canvas.addEventListener('pointerdown', updateConfirm);
  canvas.addEventListener('pointerup', updateConfirm);
  canvas.addEventListener('pointercancel', updateConfirm);
  modal.querySelector('[data-clear-sign]').onclick = () => { pad.clear(); updateConfirm(); };
  absent.addEventListener('change', updateConfirm);
  reason.addEventListener('input', updateConfirm);
  form.onsubmit = (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target).entries());
    const isAbsent = values.absent === 'on';
    try {
      const saved = store.update((current) => {
        const target = current.notes.find((item) => item.id === note.id);
        if (!target) return current;
        const updated = applyClientOutcome(target, { ...values, absent: isAbsent }, pad.value);
        current.notes[current.notes.indexOf(target)] = updated;
        current.lastClientSigner = updated.clientSigner;
        current.lastClientEmail = updated.clientEmail;
        return current;
      });
      window.dispatchEvent(new CustomEvent('client-signature-completed', { detail: { noteId: note.id, note: saved.notes.find((item) => item.id === note.id) } }));
    } catch (error) { notify(error.message); return; }
    if (index + 1 < ids.length) {
      notify('Orden firmada. Pasando a la siguiente');
      batchSignModal(ids, index + 1);
    } else {
      closeModal();
      notify('Todas las órdenes de la visita han sido firmadas');
      render();
    }
  };
  updateConfirm();
}

function saveSettings() {
  const email = document.querySelector('#set-email');
  const reportCity = document.querySelector('#set-report-city');
  store.update((data) => { data.technicianEmail = text(email?.value); data.reportCity = text(reportCity?.value) || 'Madrid'; return data; });
  notify('Configuración guardada');
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el PDF archivado'));
    reader.readAsDataURL(blob);
  });
}

async function exportBackup(data) {
  try {
    const reports = await store.listReportSnapshots?.() || [];
    const archivedReports = await Promise.all(reports.map(async ({ pdf, ...report }) => ({
      ...report,
      pdf: await blobToDataUrl(pdf)
    })));
    const payload = {
      format: 'sat-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
      reports: archivedReports
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `notas-at-copia-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`Copia exportada con ${archivedReports.length} informe${archivedReports.length === 1 ? '' : 's'} archivado${archivedReports.length === 1 ? '' : 's'}`);
  } catch (error) {
    console.error(error);
    notify(`No se pudo exportar la copia: ${error.message || 'error desconocido'}`);
  }
}

function dataUrlToBlob(value) {
  const match = String(value || '').match(/^data:([^;,]+)?(?:;base64)?,(.*)$/s);
  if (!match) throw new Error('El PDF archivado no tiene un formato válido');
  const mime = match[1] || 'application/octet-stream';
  const bytes = atob(match[2]);
  const buffer = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) buffer[index] = bytes.charCodeAt(index);
  return new Blob([buffer], { type: mime });
}

function bindClientAutofill(form) {
  const input = form.querySelector('input[name="client"]');
  if (!input || input.dataset.autofillBound) return;
  input.dataset.autofillBound = '1';
  const fill = () => {
    const data = store.read();
    const client = data.clients.find((item) => text(item.name).toLocaleLowerCase() === text(input.value).toLocaleLowerCase());
    if (!client) return;
    form.elements.city.value = client.city || '';
    form.elements.province.value = client.province || '';
    form.elements.country.value = client.country || 'España';
  };
  input.addEventListener('input', fill);
  input.addEventListener('change', fill);
  fill();
}

function bindFormBehaviors() {
  document.querySelectorAll('#visit-page-form, #visit-modal-form, #order-form').forEach(bindClientAutofill);
  const order = document.querySelector('#order-form');
  if (!order) return;
  // El módulo `technician-workflow.js` es el único dueño del botón del
  // segundo técnico. Mantener aquí otro manejador hacía que un clic ejecutase
  // dos conmutaciones y dejase el campo exactamente como estaba.
  const typeSelect = order.querySelector('#order-type');
  const typeContainer = order.querySelector('#type-fields');
  if (typeSelect && typeContainer && !typeSelect.dataset.bound) {
    typeSelect.dataset.bound = '1';
    typeContainer.innerHTML = typeFields(store.read(), typeSelect.value);
    typeSelect.addEventListener('change', () => {
      typeContainer.innerHTML = typeFields(store.read(), typeSelect.value);
      bindFormBehaviors();
      window.dispatchEvent(new CustomEvent('app-rendered', { detail: { route: location.hash.slice(1) } }));
    });
  }
  const yes = order.querySelector('[name="asmIncidentYes"]');
  const no = order.querySelector('[name="asmIncidentNo"]');
  const explanation = order.querySelector('#asm-incident-explanation');
  if (yes && no && explanation && !yes.dataset.bound) {
    const update = (event) => {
      if (event?.target === yes && yes.checked) no.checked = false;
      if (event?.target === no && no.checked) yes.checked = false;
      explanation.hidden = !yes.checked;
      explanation.querySelector('textarea').required = yes.checked;
    };
    yes.addEventListener('change', update);
    no.addEventListener('change', update);
    yes.dataset.bound = '1';
    update();
  }
}

function filterHistory() {
  const data = store.read();
  const query = text(document.querySelector('#q')?.value).toLocaleLowerCase();
  const from = text(document.querySelector('#from')?.value);
  const to = text(document.querySelector('#to')?.value);
  const matches = (visit) => {
    const notes = data.notes.filter((note) => note.visitId === visit.id && !note.deleted);
    const values = [visit.client, visit.city, visit.province, visit.country, ...notes.flatMap((note) => [note.serial, note.model, note.brand, note.type])].map((value) => text(value).toLocaleLowerCase());
    return (!query || values.some((value) => value.includes(query))) && (!from || visit.date >= from) && (!to || visit.date <= to);
  };
  const result = document.querySelector('#history-results');
  if (!result) return;
  result.innerHTML = renderVisitList(data, data.visits.filter(matches), 'Resultados');
  // El filtro reconstruye las tarjetas y, por tanto, también sus botones.
  // Reenlazamos las acciones y avisamos a los complementos que añaden
  // acciones de compartir, iconos y mejoras de accesibilidad.
  bindHistoryResultActions();
  window.dispatchEvent(new CustomEvent('app-rendered', { detail: { route: 'historial', filtered: true } }));
}

function handleImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const payload = JSON.parse(reader.result);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('El archivo no contiene una copia válida');
      const source = payload.format === 'sat-backup' && payload.data && typeof payload.data === 'object' ? payload.data : payload;
      const recognizedKeys = ['notes', 'visits', 'trash', 'visitTrash', 'templates', 'clients', 'cities', 'provinces', 'brands', 'models', 'modelCatalog'];
      if (!recognizedKeys.some((key) => Object.prototype.hasOwnProperty.call(source, key))) throw new Error('El archivo no parece una copia de la aplicación');
      store.write(source);
      let importedReports = 0;
      if (payload.format === 'sat-backup' && Array.isArray(payload.reports) && store.saveReportSnapshot) {
        for (const report of payload.reports) {
          if (!report?.id || typeof report.pdf !== 'string') continue;
          await store.saveReportSnapshot({ ...report, pdf: dataUrlToBlob(report.pdf) });
          importedReports += 1;
        }
      }
      notify(`Copia importada${importedReports ? ` con ${importedReports} informe${importedReports === 1 ? '' : 's'} archivado${importedReports === 1 ? '' : 's'}` : ''}`);
      render();
    } catch (error) {
      console.error(error);
      notify(error.message || 'Archivo no válido');
    }
  };
  reader.readAsText(file, 'utf-8');
  event.target.value = '';
}

function bindHistoryResultActions(root = document) {
  root.querySelectorAll('[data-open-note]').forEach((button) => { button.onclick = () => openNote(button.dataset.openNote); });
  root.querySelectorAll('[data-sign-note]').forEach((button) => { button.onclick = () => clientSignModal(button.dataset.signNote); });
  root.querySelectorAll('[data-delete-note]').forEach((button) => { button.onclick = () => deleteNote(button.dataset.deleteNote); });
  root.querySelectorAll('[data-delete-visit]').forEach((button) => { button.onclick = () => deleteVisit(button.dataset.deleteVisit); });
}

function bindEvents() {
  bindFormBehaviors();
  document.querySelectorAll('[data-view]').forEach((button) => {
    button.onclick = (event) => {
      event.preventDefault();
      navigate(button.dataset.view);
    };
  });
  document.querySelectorAll('[data-new-visit]').forEach((button) => { button.onclick = () => openNewVisitModal(); });
  bindHistoryResultActions();
  // La firma del cliente puede iniciarse directamente desde una tarjeta de la lista.
  // El flujo del tecnico tiene prioridad en captura cuando aun falta su firma.
  document.querySelectorAll('[data-sign-note]').forEach((button) => { button.onclick = () => clientSignModal(button.dataset.signNote); });
  document.querySelectorAll('[data-delete-note]').forEach((button) => { button.onclick = () => deleteNote(button.dataset.deleteNote); });
  document.querySelectorAll('[data-delete-visit]').forEach((button) => { button.onclick = () => deleteVisit(button.dataset.deleteVisit); });
  document.querySelectorAll('[data-close-visit]').forEach((button) => { button.onclick = () => closeVisit(button.dataset.closeVisit); });
  document.querySelectorAll('[data-back-history]').forEach((button) => { button.onclick = () => navigate('historial'); });
  document.querySelectorAll('[data-close]').forEach((button) => { button.onclick = closeModal; });
  document.querySelectorAll('[data-restore-note]').forEach((button) => { button.onclick = () => restoreNote(button.dataset.restoreNote); });
  document.querySelectorAll('[data-restore-visit]').forEach((button) => { button.onclick = () => restoreVisit(button.dataset.restoreVisit); });
  document.querySelector('#order-form')?.addEventListener('submit', (event) => { event.preventDefault(); saveOrder(event.target); });
  document.querySelector('#visit-page-form')?.addEventListener('submit', (event) => { event.preventDefault(); const visit = createVisit(event.target); navigate(`visita/${encodeURIComponent(visit.id)}`); });
  document.querySelector('#q')?.addEventListener('input', filterHistory);
  document.querySelector('#from')?.addEventListener('change', filterHistory);
  document.querySelector('#to')?.addEventListener('change', filterHistory);
  document.querySelector('[data-save-settings]')?.addEventListener('click', saveSettings);
  document.querySelector('[data-export]')?.addEventListener('click', () => exportBackup(store.read()));
  document.querySelector('#import-data')?.addEventListener('change', handleImport);
  document.querySelectorAll('[data-add]').forEach((button) => {
    button.onclick = () => {
      const input = document.querySelector(`#add-${button.dataset.add}`);
      const value = text(input?.value);
      if (!value) return;
      store.update((data) => {
        if (button.dataset.add === 'client') data.clients.push({ name: value, city: '', province: '', country: 'España' });
        else data[button.dataset.add === 'city' ? 'cities' : button.dataset.add === 'brand' ? 'brands' : 'models'].push(value);
        return data;
      });
      render();
    };
  });
  document.querySelectorAll('[data-remove]').forEach((button) => {
    button.onclick = async () => {
      if (!(await confirmAction('Eliminar elemento', 'Se quitará este elemento del catálogo.', 'Eliminar'))) return;
      store.update((data) => {
        const key = button.dataset.remove === 'client' ? 'clients' : button.dataset.remove === 'city' ? 'cities' : button.dataset.remove === 'brand' ? 'brands' : 'models';
        data[key].splice(Number(button.dataset.index), 1);
        return data;
      });
      render();
    };
  });
}

// Los botones creados dentro de dialogos nacen despues del render de la pagina. La
// delegacion se limita a `#modal` para no duplicar los handlers de las listas.
document.addEventListener('click', (event) => {
  const target = event.target.closest('#modal [data-sign-note], #modal [data-delete-note], #modal [data-close]');
  if (!target) return;
  if (target.matches('[data-sign-note]')) {
    event.preventDefault();
    clientSignModal(target.dataset.signNote);
  } else if (target.matches('[data-delete-note]')) {
    event.preventDefault();
    deleteNote(target.dataset.deleteNote);
  } else if (target.matches('[data-close]')) {
    event.preventDefault();
    closeModal();
  }
});

function openNewVisitModal() {
  const data = store.read();
  showModal(`<h2>Nueva visita</h2><p class="muted">Información común de la visita</p><form id="visit-modal-form" class="form-grid"><div class="field full"><label for="modal-client">Cliente *</label><input id="modal-client" name="client" required list="modal-clients"><datalist id="modal-clients">${data.clients.map((client) => `<option value="${esc(client.name)}"></option>`).join('')}</datalist></div><div class="field"><label for="modal-city">Ciudad</label><input id="modal-city" name="city" list="modal-cities"><datalist id="modal-cities">${data.cities.map((city) => `<option value="${esc(city)}"></option>`).join('')}</datalist></div><div class="field"><label for="modal-province">Provincia</label><select id="modal-province" name="province"><option value="">Seleccionar</option>${data.provinces.map((province) => `<option value="${esc(province)}">${esc(province)}</option>`).join('')}</select></div><div class="field"><label for="modal-country">País</label><input id="modal-country" name="country" value="España"></div><div class="field"><label for="modal-date">Fecha *</label><input id="modal-date" name="date" type="date" value="${localDateValue()}" required></div><div class="field"><label for="modal-technician">Técnico</label><input id="modal-technician" name="technician" value="${esc(technicianName(data, null))}"></div><div class="field full"><label for="modal-observations">Observaciones generales</label><textarea id="modal-observations" name="observations"></textarea></div><div class="modal-actions full"><button type="button" class="button" data-close>Cancelar</button><button class="button primary">Guardar visita</button></div></form>`);
  bindClientAutofill(modal.querySelector('#visit-modal-form'));
  modal.querySelector('#visit-modal-form').addEventListener('submit', (event) => { event.preventDefault(); const visit = createVisit(event.target); closeModal(); navigate(`visita/${encodeURIComponent(visit.id)}`); });
}

function render() {
  const data = store.read();
  const route = location.hash.slice(1) || 'inicio';
  const [view, rawId] = route.split('/');
  const id = rawId ? decodeURIComponent(rawId) : '';
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === view));
  let html = renderHome(data);
  if (view === 'historial') html = renderHistory(data);
  else if (view === 'configuracion') html = settings(data);
  else if (view === 'papelera') html = renderTrash(data);
  else if (view === 'nueva-visita') html = renderNewVisitPage(data);
  else if (view === 'visita' && id) html = renderVisit(data, id) || renderHistory(data);
  else if (view === 'orden' && id) html = renderOrder(data, id);
  main.innerHTML = html;
  bindEvents();
  window.applyTemplateTextCapacity?.(document);
  window.applySigningTextCapacity?.(document);
  window.dispatchEvent(new CustomEvent('app-rendered', { detail: { route } }));
}

// Los complementos existentes se conectan a estos puntos publicos mientras son migrados.
window.setAppView = navigate;
window.deleteIntervention = deleteNote;
window.openNewVisit = openNewVisitModal;
window.appStore = store;
window.createTransferPayload = createTransferPayload;
window.validateTransferPayload = validateTransferPayload;
window.startBatchSigning = startBatchSigning;
window.addEventListener('hashchange', render);
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY) render();
});
window.addEventListener('error', (event) => {
  if (event.error?.message?.startsWith('No se pudieron guardar')) {
    notify(event.error.message);
    console.error(event.error);
  }
});
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.message?.startsWith('No se pudieron guardar')) {
    notify(event.reason.message);
    console.error(event.reason);
  }
});
window.addEventListener('sat-storage-error', (event) => {
  const message = event.detail?.error?.message || 'No se pudo actualizar la copia durable';
  notify(`Aviso de almacenamiento: ${message}`);
  console.error(event.detail?.error || message);
});
window.addEventListener('sat-report-archive-error', (event) => {
  const message = event.detail?.error?.message || 'No se pudo archivar el informe final';
  notify(`PDF generado, pero no archivado: ${message}`);
  console.error(event.detail?.error || message);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && modal && !modal.hidden) closeModal();
});
render();
store.ready().then(() => render());

