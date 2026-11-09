(function () {
  'use strict';

  const STORAGE_KEY = 'notas-at-data-v1';
  const VOLUMES_BY_FAMILY = {
    SE: [1500, 3000],
    II: [1500, 3000, 4500, 6000, 9000, 12000],
    III: [1500, 3000, 4500, 6000, 9000, 12000],
    IV: [1500, 3000, 4500, 6000, 9000, 12000, 18000, 21000, 24000]
  };
  const ACTIVE_COLUMNS_BY_VOLUME = {
    1500: [0],
    3000: [0, 2],
    4500: [0, 1, 2],
    6000: [0, 1, 2, 3],
    9000: [0, 1, 2, 3, 4, 5],
    12000: [0, 1, 2, 3, 4, 5, 6, 7],
    18000: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    21000: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    24000: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
  };
  const DETECTOR_LABELS_BY_FAMILY = {
    SE: ['1', '2'],
    II: ['1', '2', '3', '4', '5', '6', '7', '8'],
    III: ['1', '2', '3', '4', '5', '6', '7', '8'],
    IV: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2', 'E1', 'E2', 'F1', 'F2', 'G1', 'G2', 'H1', 'H2']
  };
  const PARAMETER_ROWS_BY_FAMILY = {
    SE: [1, 2, 5, 6, 7, 8],
    II: [0, 1, 2, 5, 6, 7, 8],
    III: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    IV: [0, 1, 2, 3, 4, 5, 6, 7, 8]
  };
  const PARAMETER_DEFAULTS_BY_FAMILY = {
    SE: ['', '', '6', '', '', '99.9', '1000', '1', ''],
    II: ['', '', '6', '', '', '99', '10000', '50', ''],
    III: ['', '', '4.5', '7', '10000', '', '', '100', ''],
    IV: ['', '', '5.5', '7', '9', '99.9', '10000', '250', '']
  };
  const CHECK_SUPPORT_BY_FAMILY = {
    localLineDriver: ['II'],
    interfacePc: ['SE', 'II', 'IV'],
    converter: ['III', 'IV'],
    printer: ['SE', 'II', 'III', 'IV']
  };

  // Fuente unica para el formulario ASM y la exportacion PDF.
  window.asmReportConfig = Object.freeze({
    volumesByFamily: VOLUMES_BY_FAMILY,
    activeColumnsByVolume: ACTIVE_COLUMNS_BY_VOLUME,
    detectorLabelsByFamily: DETECTOR_LABELS_BY_FAMILY
  });

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function readStoredBrands() {
    if (window.appStore?.read) return window.appStore.read().brands || [];
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return Array.isArray(data.brands) ? data.brands : [];
    } catch {
      return [];
    }
  }

  function orderForm() {
    return document.querySelector('#order-form');
  }

  function isAsm(form) {
    return form?.querySelector('#order-type')?.value === 'ASM / Mantenimiento';
  }

  function ensureBrandSelect(form) {
    if (!isAsm(form)) {
      const select = form?.querySelector('select[name="brand"]');
      if (select) {
        const input = document.createElement('input');
        input.name = 'brand';
        input.type = 'text';
        input.id = select.id;
        input.className = select.className;
        input.setAttribute('list', 'brands');
        input.value = select.value === 'Otra / no identificada' ? '' : select.value;
        select.replaceWith(input);
      }
      form?.querySelector('#asm-brand-other')?.remove();
      return;
    }
    const input = form?.querySelector('input[name="brand"]');
    let select = form?.querySelector('select[name="brand"]');
    if (input && !select) {
      const current = input.value.trim() || 'Thermo Fisher Scientific';
      const values = ['Thermo Fisher Scientific', ...readStoredBrands(), 'Otra / no identificada'];
      if (current && !values.includes(current)) values.splice(values.length - 1, 0, current);
      select = document.createElement('select');
      select.name = 'brand';
      select.id = input.id;
      select.className = input.className;
      select.innerHTML = [...new Set(values)].map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
      select.value = current;
      input.replaceWith(select);
    }
    syncOtherBrand(form);
  }

  function syncOtherBrand(form) {
    const select = form?.querySelector('select[name="brand"]');
    const container = select?.closest('.field');
    if (!select || !container) return;
    let field = container.querySelector('#asm-brand-other');
    if (!field) {
      field = document.createElement('div');
      field.id = 'asm-brand-other';
      field.className = 'field v2-space';
      field.innerHTML = '<label for="asm-brand-other-text">Especifica la marca *</label><input id="asm-brand-other-text" name="brandOtherInfo" type="text" autocomplete="off">';
      container.appendChild(field);
    }
    const input = field.querySelector('input');
    const active = select.value === 'Otra / no identificada';
    field.hidden = !active;
    input.disabled = !active;
    input.required = active;
  }

  function ensureAsmSelectors(form) {
    if (!isAsm(form)) return;
    const panel = form.querySelector('#type-fields > .panel');
    if (!panel) return;
    let wrapper = panel.querySelector('[data-asm-rules]');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = 'asm-rules-selection form-grid';
      wrapper.dataset.asmRules = '1';
      wrapper.innerHTML = '<div class="field"><label for="asm-family">Familia ASM *</label><select id="asm-family" name="asmFamily" required><option value="">Seleccionar</option><option>SE</option><option>II</option><option>III</option><option>IV</option></select></div><div class="field"><label for="asm-volume">Volumen total (cada detector = 1500) *</label><select id="asm-volume" name="asmVolume" required disabled><option value="">Seleccionar familia primero</option></select></div>';
      const heading = panel.querySelector('h2');
      panel.insertBefore(wrapper, heading?.nextSibling || panel.firstChild);
      wrapper.querySelector('#asm-family').addEventListener('change', () => {
        updateVolumeOptions(form);
        updateAsmState(form);
      });
      wrapper.querySelector('#asm-volume').addEventListener('change', () => updateAsmState(form));
    }
    updateVolumeOptions(form);
    updateAsmState(form);
  }

  function syncModelField(form) {
    const model = form.querySelector('input[name="model"]');
    if (!model) return;
    const label = model.closest('.field')?.querySelector('label');

    if (!isAsm(form)) {
      if (model.dataset.asmDerived === '1') model.value = '';
      model.readOnly = false;
      model.removeAttribute('aria-readonly');
      model.placeholder = '';
      model.setAttribute('list', 'models');
      model.removeAttribute('title');
      if (label) label.textContent = 'Modelo *';
      delete model.dataset.asmDerived;
      return;
    }

    const family = form.querySelector('#asm-family')?.value || '';
    const volume = form.querySelector('#asm-volume')?.value || '';
    model.readOnly = true;
    model.setAttribute('aria-readonly', 'true');
    model.removeAttribute('list');
    model.dataset.asmDerived = '1';
    model.placeholder = 'Se completa con familia y volumen';
    model.title = 'Se calcula automáticamente a partir de la familia ASM y el volumen';
    if (label) label.textContent = 'Modelo ASM (automático) *';
    model.value = family && volume ? `ASM ${family} ${volume}` : '';
  }

  function updateVolumeOptions(form) {
    const family = form.querySelector('#asm-family')?.value || '';
    const volume = form.querySelector('#asm-volume');
    if (!volume) return;
    const previous = volume.value;
    const values = VOLUMES_BY_FAMILY[family] || [];
    volume.disabled = !family;
    const optionsKey = `${family}:${values.join(',')}`;
    if (volume.dataset.optionsKey !== optionsKey) {
      volume.innerHTML = family
        ? `<option value="">Seleccionar</option>${values.map((value) => `<option value="${value}">${value}</option>`).join('')}`
        : '<option value="">Seleccionar familia primero</option>';
      volume.dataset.optionsKey = optionsKey;
    }
    if (values.includes(Number(previous))) volume.value = previous;
  }

  function setGroupAvailability(group, enabled) {
    if (!group) return;
    group.classList.toggle('asm-unavailable', !enabled);
    group.setAttribute('aria-disabled', String(!enabled));
    const yes = group.querySelector('input[name^="asmCheck"][name$="Yes"]');
    const match = yes?.name.match(/^asmCheck(\d+)Yes$/);
    const form = group.closest('form');
    const hiddenName = match ? `asmCheck${match[1]}NA` : '';
    const previousHidden = hiddenName ? form?.querySelector(`input[data-asm-unavailable-na="${match[1]}"]`) : null;
    if (previousHidden && enabled) previousHidden.remove();
    group.querySelectorAll('input').forEach((input) => {
      input.disabled = !enabled;
      if (!enabled) input.checked = input.name.endsWith('NA');
      else input.checked = false;
    });
    if (!enabled && hiddenName && form && !previousHidden) {
      const hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = hiddenName;
      hidden.value = 'on';
      hidden.dataset.asmUnavailableNa = match[1];
      form.appendChild(hidden);
    }
  }

  function updateChecks(form, family) {
    const groups = [
      ['localLineDriver', 0],
      ['interfacePc', 1],
      ['converter', 2],
      ['printer', 3]
    ];
    groups.forEach(([key, index]) => {
      const input = form.querySelector(`[name="asmCheck${index}Yes"]`);
      const group = input?.closest('.inset');
      setGroupAvailability(group, CHECK_SUPPORT_BY_FAMILY[key].includes(family));
    });
  }

  function updateSensors(form, family) {
    const sensor2 = form.querySelector('input[name="s2PresentYes"]')?.closest('.inset');
    setGroupAvailability(sensor2, ['II', 'III', 'IV'].includes(family));
  }

  function updateParameters(form, family, volume) {
    const activeRows = PARAMETER_ROWS_BY_FAMILY[family] || [];
    const activeColumns = ACTIVE_COLUMNS_BY_VOLUME[volume] || [];
    form.querySelectorAll('.asm-table tbody tr').forEach((row, rowIndex) => {
      const rowEnabled = activeRows.includes(rowIndex);
      row.classList.toggle('asm-unavailable', !rowEnabled);
      row.querySelectorAll('input[name^="param_"]').forEach((input) => {
        const match = input.name.match(/^param_\d+_(\d+)$/);
        const columnIndex = match ? Number(match[1]) : -1;
        const enabled = rowEnabled && activeColumns.includes(columnIndex);
        input.disabled = !enabled;
        if (!enabled) {
          input.value = '';
          delete input.dataset.asmDefault;
        } else {
          const defaultValue = PARAMETER_DEFAULTS_BY_FAMILY[family]?.[rowIndex] || '';
          if (defaultValue && (!input.value || input.dataset.asmDefault === '1')) {
            input.value = defaultValue;
            input.dataset.asmDefault = '1';
          } else if (!defaultValue && input.dataset.asmDefault === '1') {
            input.value = '';
            delete input.dataset.asmDefault;
          }
        }
      });
    });
  }

  function updateAsmState(form) {
    if (!isAsm(form)) return;
    const family = form.querySelector('#asm-family')?.value || '';
    const volume = Number(form.querySelector('#asm-volume')?.value || 0);
    const asmIvFields = form.querySelector('[data-asmiv-fields]');
    if (asmIvFields) {
      const enabled = family === 'IV';
      asmIvFields.hidden = !enabled;
      asmIvFields.querySelectorAll('input, select, textarea').forEach((input) => { input.disabled = !enabled; });
    }
    const frequency = form.querySelector('[data-asm-frequency]');
    if (frequency) {
      const enabled = family === 'II';
      frequency.hidden = !enabled;
      const input = frequency.querySelector('input[name="frequency"]');
      if (input) input.disabled = !enabled;
    }
    updateParameters(form, family, volume);
    updateChecks(form, family);
    updateSensors(form, family);
    syncModelField(form);
  }

  function refresh() {
    const form = orderForm();
    if (!form) return;
    ensureBrandSelect(form);
    ensureAsmSelectors(form);
    syncModelField(form);
  }

  document.addEventListener('change', (event) => {
    if (event.target?.id !== 'order-type') return;
    window.setTimeout(refresh, 0);
  });
  document.addEventListener('change', (event) => {
    if (event.target.matches('#order-form select[name="brand"]')) syncOtherBrand(event.target.form);
  });
  document.addEventListener('input', (event) => {
    if (event.target.matches('#order-form input[name^="param_"]')) delete event.target.dataset.asmDefault;
  });
  window.addEventListener('app-rendered', refresh);
  window.setTimeout(refresh, 0);
})();
