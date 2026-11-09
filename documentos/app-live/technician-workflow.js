(function () {
  'use strict';

  const KEY = 'notas-at-data-v1';

  function readData() {
    if (window.appStore?.read) return window.appStore.read();
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
  }

  function saveData(data) {
    if (window.appStore?.write) { window.appStore.write(data); return; }
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function toast(message) {
    const element = document.querySelector('#toast');
    if (!element) return;
    element.textContent = message;
    element.classList.add('show');
    window.setTimeout(() => element.classList.remove('show'), 2600);
  }

  function closeModal() {
    const modal = document.querySelector('#modal');
    if (!modal) return;
    modal.hidden = true;
    modal.innerHTML = '';
  }

  function technicianName(data, note, slot) {
    const names = String(note?.technician || '').split(/\s*\/\s*|\s*;\s*/).map((value) => value.trim()).filter(Boolean);
    if (slot === 1) return note?.technician1Name || names[0] || data.technician1Name || data.technicianName || '';
    return note?.technician2Name || names[1] || '';
  }

  function technicianSignature(data, note, slot) {
    if (slot === 1) return note?.technician1Signature || data.technician1Signature || data.technicianSignature || '';
    return note?.technician2Signature || '';
  }

  function nextSlot(data, note) {
    if (!technicianSignature(data, note, 1)) return 1;
    if (technicianName(data, note, 2) && !technicianSignature(data, note, 2)) return 2;
    return 0;
  }

  function fillClient(form) {
    const input = form?.querySelector('input[name="client"]');
    if (!input) return;
    const data = readData();
    const client = (data.clients || []).find((item) => String(item.name || '').trim().toLowerCase() === input.value.trim().toLowerCase());
    if (!client) return;
    const city = form.querySelector('input[name="city"]');
    const province = form.querySelector('select[name="province"]');
    const country = form.querySelector('input[name="country"]');
    if (city) city.value = client.city || '';
    if (province) province.value = client.province || '';
    if (country) country.value = client.country || 'España';
  }

  function setupClient(form) {
    const input = form?.querySelector('input[name="client"]');
    if (!input) return;
    if (!input.getAttribute('list')) {
      const list = document.createElement('datalist');
      list.id = `workflow-clients-${Math.random().toString(16).slice(2)}`;
      list.innerHTML = (readData().clients || []).map((client) => `<option value="${esc(client.name)}"></option>`).join('');
      input.setAttribute('list', list.id);
      input.insertAdjacentElement('afterend', list);
    }
    if (input.dataset.clientWorkflow) return;
    input.dataset.clientWorkflow = '1';
    input.addEventListener('input', () => fillClient(form));
    input.addEventListener('change', () => fillClient(form));
    fillClient(form);
  }

  function setupSecondTechnician(form) {
    if (!form || form.id !== 'order-form') return;
    const wrapper = form.querySelector('.optional-second-technician');
    const button = wrapper?.querySelector('[data-add-second-tech]');
    const fields = wrapper?.querySelector('[data-second-tech-fields]');
    const input = wrapper?.querySelector('input[name="technician2Name"]');
    if (!button || !fields || !input || button.dataset.workflowBound) return;
    button.dataset.workflowBound = '1';
    button.addEventListener('click', () => {
      const visible = fields.hidden;
      fields.hidden = !visible;
      input.disabled = !visible;
      button.textContent = visible ? 'Ocultar segundo técnico' : 'Añadir segundo técnico';
      if (visible) input.focus(); else input.value = '';
    });
  }

  function prepareNoteActions() {
    const data = readData();
    document.querySelectorAll('[data-sign-note]').forEach((button) => {
      const note = (data.notes || []).find((item) => item.id === button.dataset.signNote);
      if (!note || note.status !== 'pending') return;
      const slot = nextSlot(data, note);
      const label = slot ? `Firmar ${slot === 1 ? 'técnico' : 'segundo técnico'}` : 'Firma cliente';
      const visibleLabel = button.querySelector('.button-label');
      if (visibleLabel) visibleLabel.textContent = label;
      else button.textContent = label;
    });
  }

  function guardBatchSigning() {
    const start = window.startBatchSigning;
    if (typeof start !== 'function' || start.__technicianGuard) return;
    const guarded = (visitId) => {
      const data = readData();
      const pending = (data.notes || []).filter((note) => note.visitId === visitId && !note.deleted && note.status === 'pending');
      const next = pending.map((note) => ({ note, slot: nextSlot(data, note) })).find((entry) => entry.slot);
      if (next) {
        technicianSignModal(next.note.id, next.slot);
        return;
      }
      start(visitId);
    };
    guarded.__technicianGuard = true;
    window.startBatchSigning = guarded;
  }

  function drawInitial(canvas, dataUrl) {
    if (!dataUrl) return;
    const image = new Image();
    image.onload = () => canvas.getContext('2d').drawImage(image, 0, 0, canvas.clientWidth, canvas.clientHeight);
    image.src = dataUrl;
  }

  function technicianSignModal(id, slot) {
    const data = readData();
    const note = (data.notes || []).find((item) => item.id === id);
    if (!note) return;
    const saved = technicianSignature(data, note, slot);
    const name = technicianName(data, note, slot);
    const modal = document.querySelector('#modal');
    if (!modal) return;
    modal.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="technician-sign-title"><h2 id="technician-sign-title">Firma del ${slot === 1 ? 'técnico habitual' : 'segundo técnico'}</h2><p class="muted">${esc(note.client || '')} · ${esc(note.model || note.equipment || '')}</p><div class="field full"><label>Nombre del técnico</label><input id="workflow-technician-name" value="${esc(name)}" autocomplete="name"></div>${saved ? '<label class="check"><input type="checkbox" id="workflow-use-saved" checked> Usar firma guardada</label>' : ''}<p class="signature-instructions">Firma dentro del recuadro blanco usando el dedo, lápiz o ratón.</p><div class="signature-box"><canvas id="workflow-technician-signature" aria-label="Firma del técnico"></canvas></div><div class="actions v2-space"><button type="button" class="button small" data-workflow-clear-sign>Borrar firma</button></div>${slot === 1 ? '<label class="check"><input type="checkbox" id="workflow-save-default"> Guardar como firma habitual</label>' : ''}<div class="modal-actions signature-actions"><button type="button" class="button" data-workflow-cancel>Cancelar</button><button type="button" class="button primary" id="workflow-confirm-technician">Confirmar firma</button></div></div>`;
    modal.hidden = false;
    const canvas = modal.querySelector('#workflow-technician-signature');
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
    drawInitial(canvas, saved);
    let drawing = false;
    let dirty = false;
    const point = (event) => { const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; };
    canvas.addEventListener('pointerdown', (event) => { drawing = true; dirty = true; canvas.setPointerCapture(event.pointerId); canvas._lastPoint = point(event); });
    canvas.addEventListener('pointermove', (event) => { if (!drawing) return; const next = point(event); context.beginPath(); context.moveTo(canvas._lastPoint.x, canvas._lastPoint.y); context.lineTo(next.x, next.y); context.stroke(); canvas._lastPoint = next; });
    canvas.addEventListener('pointerup', () => { drawing = false; canvas._lastPoint = null; });
    modal.querySelector('[data-workflow-clear-sign]').onclick = () => { context.clearRect(0, 0, width, height); dirty = true; const checkbox = modal.querySelector('#workflow-use-saved'); if (checkbox) checkbox.checked = false; };
    modal.querySelector('[data-workflow-cancel]').onclick = closeModal;
    modal.querySelector('#workflow-confirm-technician').onclick = () => {
      const useSaved = modal.querySelector('#workflow-use-saved')?.checked;
      const signature = useSaved && saved ? saved : (dirty ? canvas.toDataURL('image/png') : '');
      const technician = modal.querySelector('#workflow-technician-name').value.trim();
      if (!technician || !signature) { toast('Indica el nombre y dibuja la firma del técnico'); return; }
      const current = readData();
      const target = (current.notes || []).find((item) => item.id === id);
      if (!target) return;
      target[`technician${slot}Name`] = technician;
      target[`technician${slot}Signature`] = signature;
      target[`technician${slot}SignedAt`] = new Date().toISOString();
      if (slot === 1 && modal.querySelector('#workflow-save-default')?.checked) {
        current.technician1Name = technician;
        current.technicianName = technician;
        current.technician1Signature = signature;
        current.technicianSignature = signature;
      }
      target.updated = new Date().toISOString();
      saveData(current);
      closeModal();
      toast('Firma del técnico guardada');
      window.setAppView?.(location.hash.slice(1));
    };
  }

  document.addEventListener('click', (event) => {
    const technicianButton = event.target.closest('[data-sign-technician]');
    if (technicianButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      technicianSignModal(technicianButton.dataset.signTechnician, Number(technicianButton.dataset.technicianSlot) || 1);
      return;
    }
    const button = event.target.closest('[data-sign-note]');
    if (!button) return;
    const data = readData();
    const note = (data.notes || []).find((item) => item.id === button.dataset.signNote);
    const slot = note && nextSlot(data, note);
    if (!slot) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    technicianSignModal(note.id, slot);
  }, true);

  function enhance() {
    document.querySelectorAll('#visit-page-form, #visit-modal-form, #order-form').forEach((form) => {
      setupClient(form);
      const technician = form.querySelector('input[name="technician"]');
      const defaultName = readData().technician1Name || readData().technicianName || '';
      if (technician && !technician.value.trim() && defaultName) technician.value = defaultName;
      setupSecondTechnician(form);
    });
    prepareNoteActions();
    guardBatchSigning();
  }

  let queued = false;
  const schedule = () => { if (queued) return; queued = true; window.setTimeout(() => { queued = false; enhance(); }, 0); };
  window.addEventListener('app-rendered', schedule);
  window.addEventListener('hashchange', schedule);
  schedule();
})();
