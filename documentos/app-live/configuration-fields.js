(function () {
  'use strict';

  const KEY = 'notas-at-data-v1';
  const read = () => {
    if (window.appStore?.read) return window.appStore.read();
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) { return {}; }
  };

  function addField(className, html, after) {
    const field = document.createElement('div');
    field.className = className;
    field.innerHTML = html;
    after.insertAdjacentElement('afterend', field);
    return field;
  }

  function setupSignature(canvas, initial) {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(280, Math.round(canvas.getBoundingClientRect().width || 480));
    const height = 150;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = '100%';
    canvas.style.height = height + 'px';
    canvas.style.touchAction = 'none';
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#202020';

    if (initial) {
      const image = new Image();
      image.onload = () => ctx.drawImage(image, 0, 0, width, height);
      image.src = initial;
    }

    let drawing = false;
    let dirty = false;
    let last = null;
    const point = (event) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    canvas.addEventListener('pointerdown', (event) => {
      drawing = true;
      dirty = true;
      last = point(event);
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!drawing) return;
      const next = point(event);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(next.x, next.y);
      ctx.stroke();
      last = next;
    });
    const stop = () => { drawing = false; last = null; };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
    return {
      get value() { return dirty ? canvas.toDataURL('image/png') : initial || ''; },
      clear() { ctx.clearRect(0, 0, width, height); dirty = true; }
    };
  }

  function enhance() {
    const email = document.querySelector('#set-email');
    const panel = email?.closest('.panel');
    if (!email || !panel || panel.dataset.technicianFields) return;
    panel.dataset.technicianFields = '1';
    const data = read();
    const emailField = email.closest('.field') || email.parentElement;
    const reportCityField = document.querySelector('#set-report-city')?.closest('.field');
    const footerLine1Field = reportCityField && addField('field full', '<label for="set-footer-line-1">Pie de informe · línea 1</label><input id="set-footer-line-1" maxlength="180">', reportCityField);
    const footerLine2Field = footerLine1Field && addField('field full', '<label for="set-footer-line-2">Pie de informe · línea 2</label><input id="set-footer-line-2" maxlength="240">', footerLine1Field);
    const footerLine1 = data.footerLine1 || 'División de Protección Radiológica y Física Médica';
    const footerLine2 = data.footerLine2 || 'Tel: +34 913 52 54 54 · Fax: +34 913 52 46 85 · Web: www.atfisica.com · E-mail: atfisica@atfisica.com';
    if (footerLine1Field) footerLine1Field.querySelector('input').value = footerLine1;
    if (footerLine2Field) footerLine2Field.querySelector('input').value = footerLine2;
    document.querySelector('#technician-signature-panel')?.remove();
    const slots = [
      { id: '1', label: 'Técnico habitual', nameKey: 'technician1Name', signatureKey: 'technician1Signature', legacyName: 'technicianName', legacySignature: 'technicianSignature' }
    ];
    const signatures = slots.map((slot, index) => {
      const nameId = `set-${slot.nameKey}`;
      const signatureId = `set-${slot.signatureKey}`;
      const nameField = addField('field full', `<label for="${nameId}">Nombre del ${slot.label.toLowerCase()}</label><input id="${nameId}" autocomplete="name">`, index === 0 ? emailField : document.querySelector(`#set-${slots[index - 1].signatureKey}`)?.closest('.field'));
      nameField.querySelector('input').value = data[slot.nameKey] || (slot.legacyName ? data[slot.legacyName] || '' : '');
      const signatureField = addField('field full technician-signature-settings', `<label for="${signatureId}">Firma del ${slot.label.toLowerCase()}</label><p class="signature-instructions">Firma dentro del recuadro blanco usando el dedo, lápiz o ratón.</p><canvas id="${signatureId}" aria-label="Firma del ${slot.label.toLowerCase()}"></canvas><button type="button" class="button small" data-clear-technician-signature="${slot.id}">Borrar firma</button>`, nameField);
      const canvas = signatureField.querySelector('canvas');
      const initial = data[slot.signatureKey] || (slot.legacySignature ? data[slot.legacySignature] || '' : '');
      const signature = setupSignature(canvas, initial);
      signatureField.querySelector('[data-clear-technician-signature]').addEventListener('click', signature.clear);
      return { slot, signature };
    });
    const save = panel.querySelector('[data-save-settings]');
    save?.addEventListener('click', () => {
      const latest = read();
      latest.technician1Name = document.querySelector('#set-technician1Name')?.value.trim() || '';
      latest.technician1Signature = signatures[0].signature.value;
      latest.technician2Name = '';
      latest.technician2Signature = '';
      latest.technicianName = latest.technician1Name;
      latest.technicianSignature = latest.technician1Signature;
      latest.footerLine1 = document.querySelector('#set-footer-line-1')?.value.trim() || footerLine1;
      latest.footerLine2 = document.querySelector('#set-footer-line-2')?.value.trim() || footerLine2;
      if (window.appStore?.write) window.appStore.write(latest);
      else localStorage.setItem(KEY, JSON.stringify(latest));
    });
  }

  window.addEventListener('app-rendered', enhance);
  enhance();
})();
