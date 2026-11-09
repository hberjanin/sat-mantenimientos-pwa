(function () {
  'use strict';

  const KEY = 'notas-at-data-v1';
  const FORMAT = 'sat-visita';
  const VERSION = 1;
  const TECHNICIAN_FIELDS = ['technician', 'technicianName', 'technician1Name', 'technician1Signature', 'technician2Name', 'technician2Signature', 'technicianSignature'];
  const CLIENT_SIGNATURE_FIELDS = ['clientSignature', 'clientSigner', 'clientEmail', 'signedAt', 'clientAbsent', 'absenceReason'];

  function readData() {
    if (window.appStore?.read) return window.appStore.read();
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) { return {}; }
  }

  function writeData(data) {
    if (window.appStore?.write) { window.appStore.write(data); return; }
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function currentVisitId() {
    const match = location.hash.match(/^#visita\/([^/]+)$/);
    return match?.[1] || '';
  }

  function notify(message) {
    const toast = document.querySelector('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 3200);
  }

  function hasClientOutcome(note) {
    return note?.status === 'signed' || note?.status === 'absent' || note?.status === 'sent'
      || Boolean(note?.clientSignature || note?.signedAt || note?.clientSigner);
  }

  function localTechnician(data) {
    return {
      name: String(data.technician1Name || data.technicianName || '').trim(),
      signature: String(data.technician1Signature || data.technicianSignature || '').trim()
    };
  }

  function withoutFields(source, fields) {
    const copy = { ...source };
    fields.forEach((field) => delete copy[field]);
    return copy;
  }

  function exportVisitData(visit) {
    return withoutFields(visit, TECHNICIAN_FIELDS);
  }

  function exportNoteData(note) {
    const copy = withoutFields(note, [...TECHNICIAN_FIELDS, ...CLIENT_SIGNATURE_FIELDS]);
    copy.status = 'pending';
    copy.deleted = false;
    delete copy.deletedAt;
    return copy;
  }

  function importNoteData(note, data) {
    const technician = localTechnician(data);
    const copy = withoutFields(note, CLIENT_SIGNATURE_FIELDS);
    return {
      ...copy,
      visitId: note.visitId,
      status: 'pending',
      deleted: false,
      technician: technician.name,
      technician1Name: technician.name,
      technician1Signature: technician.signature,
      technician2Name: '',
      technician2Signature: '',
      technicianSignature: technician.signature
    };
  }

  function downloadVisit(id) {
    const data = readData();
    const visit = (data.visits || []).find((item) => item.id === id);
    if (!visit) return;
    const notes = (data.notes || []).filter((note) => note.visitId === id && !note.deleted);
    if (notes.some(hasClientOutcome)) {
      notify('No se puede exportar: la visita ya tiene una orden firmada por el cliente');
      return;
    }
    let corePayload;
    try {
      corePayload = window.createTransferPayload?.(data, id);
    } catch (error) {
      notify(error.message || 'No se puede exportar la visita');
      return;
    }
    const payload = {
      ...corePayload || {
        format: FORMAT,
        version: VERSION,
        exportedAt: new Date().toISOString(),
        visit: exportVisitData(visit),
        notes: notes.map(exportNoteData)
      },
      catalogs: {
        clients: (data.clients || []).filter((client) => client.name === visit.client),
        cities: visit.city ? [visit.city] : [],
        provinces: visit.province ? [visit.province] : [],
        brands: [...new Set(notes.map((note) => note.brandOtherInfo || note.brand).filter(Boolean))],
        models: [...new Set(notes.map((note) => note.model).filter(Boolean))],
        modelCatalog: (Array.isArray(data.modelCatalog) ? data.modelCatalog : []).filter((entry) => {
          const name = typeof entry === 'string' ? entry : entry?.name || entry?.model;
          return notes.some((note) => String(note.model || '').toLocaleLowerCase() === String(name || '').toLocaleLowerCase());
        })
      }
    };
    const filename = `visita-${String(visit.client || 'sin-cliente').replace(/[^\wáéíóúüñ-]+/gi, '-').replace(/^-|-$/g, '')}-${visit.date || 'sin-fecha'}.sat-visita.json`;
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Visita exportada para móvil o tablet');
  }

  function validPayload(payload) {
    const validation = window.validateTransferPayload?.(payload);
    if (validation) return validation;
    return { ok: Boolean(payload && payload.format === FORMAT && payload.version === VERSION && payload.visit?.id
      && Array.isArray(payload.notes) && !payload.notes.some(hasClientOutcome)), reason: 'Formato no válido' };
  }

  function mergeCatalogs(data, catalogs) {
    if (!catalogs || typeof catalogs !== 'object') return;
    ['cities', 'provinces', 'brands', 'models'].forEach((key) => {
      data[key] = Array.isArray(data[key]) ? data[key] : [];
      (Array.isArray(catalogs[key]) ? catalogs[key] : []).forEach((value) => {
        if (value && !data[key].some((current) => String(current).toLowerCase() === String(value).toLowerCase())) data[key].push(value);
      });
    });
    data.modelCatalog = Array.isArray(data.modelCatalog) ? data.modelCatalog : [];
    (Array.isArray(catalogs.modelCatalog) ? catalogs.modelCatalog : []).forEach((entry) => {
      const normalized = typeof entry === 'string' ? { name: entry, brand: '' } : { name: entry?.name || entry?.model || '', brand: entry?.brand || entry?.brandName || '' };
      if (!normalized.name) return;
      const exists = data.modelCatalog.some((current) => {
        const currentName = typeof current === 'string' ? current : current?.name || current?.model;
        const currentBrand = typeof current === 'string' ? '' : current?.brand || current?.brandName || '';
        return String(currentName).toLocaleLowerCase() === normalized.name.toLocaleLowerCase()
          && String(currentBrand).toLocaleLowerCase() === normalized.brand.toLocaleLowerCase();
      });
      if (!exists) data.modelCatalog.push(normalized);
      if (!data.models.some((model) => String(model).toLocaleLowerCase() === normalized.name.toLocaleLowerCase())) data.models.push(normalized.name);
      if (normalized.brand && !data.brands.some((brand) => String(brand).toLocaleLowerCase() === normalized.brand.toLocaleLowerCase())) data.brands.push(normalized.brand);
    });
    data.clients = Array.isArray(data.clients) ? data.clients : [];
    (Array.isArray(catalogs.clients) ? catalogs.clients : []).forEach((client) => {
      if (client?.name && !data.clients.some((current) => String(current.name).toLowerCase() === String(client.name).toLowerCase())) data.clients.push(client);
    });
  }

  function importVisit(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        const validation = validPayload(payload);
        if (!validation.ok) throw new Error(validation.reason || 'Formato no válido');
        const data = readData();
        data.visits = Array.isArray(data.visits) ? data.visits : [];
        data.notes = Array.isArray(data.notes) ? data.notes : [];
        const index = data.visits.findIndex((visit) => visit.id === payload.visit.id);
        if (index >= 0 && !window.confirm('Esta visita ya existe. ¿Actualizarla con el archivo importado?')) return;
        const technician = localTechnician(data);
        const importedVisit = {
          ...withoutFields(payload.visit, TECHNICIAN_FIELDS),
          technician: technician.name,
          importedAt: new Date().toISOString()
        };
        if (index >= 0) data.visits[index] = importedVisit; else data.visits.unshift(importedVisit);
        data.notes = data.notes.filter((note) => note.visitId !== payload.visit.id);
        data.notes.push(...payload.notes.map((note) => importNoteData({ ...note, visitId: payload.visit.id }, data)));
        mergeCatalogs(data, payload.catalogs);
        writeData(data);
        notify('Visita importada correctamente');
        window.setTimeout(() => {
          if (location.hash === `#visita/${payload.visit.id}`) location.reload();
          else location.hash = `visita/${payload.visit.id}`;
        }, 250);
      } catch (_) {
        notify('El archivo no es una visita válida');
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  function mountVisitExport() {
    const toolbar = document.querySelector('.toolbar');
    const id = currentVisitId();
    if (!toolbar || !id || toolbar.querySelector('[data-export-visit]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button';
    button.dataset.exportVisit = id;
    const data = readData();
    const notes = (data.notes || []).filter((note) => note.visitId === id && !note.deleted);
    const blocked = notes.some(hasClientOutcome);
    button.textContent = blocked ? 'Exportación bloqueada' : 'Exportar visita';
    button.title = blocked ? 'La visita ya tiene una orden firmada por el cliente' : 'Exportar esta visita para continuarla en móvil o tablet';
    button.disabled = blocked;
    if (!blocked) button.addEventListener('click', () => downloadVisit(id));
    toolbar.insertBefore(button, toolbar.lastElementChild);
  }

  function mountHistoryImport() {
    if (location.hash !== '#historial' || document.querySelector('#visit-transfer-panel')) return;
    const results = document.querySelector('#history-results');
    if (!results) return;
    const panel = document.createElement('section');
    panel.className = 'panel visit-transfer-panel';
    panel.id = 'visit-transfer-panel';
    panel.innerHTML = '<div><h2>Intercambio de visitas</h2><p class="hint">Importa una visita sin firma del cliente para continuarla. El técnico y su firma se toman de esta aplicación.</p></div><div class="actions"><label class="button" for="visit-import-file">Importar visita</label><input id="visit-import-file" type="file" accept=".json,.sat-visita,application/json" hidden></div>';
    results.parentNode.insertBefore(panel, results);
    panel.querySelector('#visit-import-file').addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (file) importVisit(file);
      event.target.value = '';
    });
  }

  function mount() {
    mountVisitExport();
    mountHistoryImport();
  }

  window.addEventListener('app-rendered', mount);
  window.addEventListener('hashchange', () => window.setTimeout(mount, 0));
  window.setTimeout(mount, 0);
}());
