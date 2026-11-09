(function () {
  'use strict';

  const KEY = 'notas-at-data-v1';
  const TYPES = {
    general: 'Intervención general',
    asm: 'ASM / Mantenimiento'
  };
  const GENERAL_CHECKS = ['Instalación', 'Mantenimiento', 'Reparación', 'Otros'];
  const DEFAULT_REPORT_TITLE = 'INFORME DE REVISIÓN';

  function read() {
    if (window.appStore?.read) return window.appStore.read();
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || '{}');
      data.templates = Array.isArray(data.templates) ? data.templates : [];
      return data;
    } catch (_) {
      return { templates: [] };
    }
  }

  function save(data) {
    if (window.appStore?.write) { window.appStore.write(data); return; }
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function typeLabel(type) {
    return type === TYPES.asm ? TYPES.asm : TYPES.general;
  }

  function renderSettings() {
    if (location.hash !== '#configuracion' || document.querySelector('#template-manager')) return;
    const main = document.querySelector('#main');
    if (!main) return;
    const data = read();
    const panel = document.createElement('section');
    panel.className = 'panel config-v2-panel intervention-template-panel';
    panel.id = 'template-manager';
    panel.innerHTML = `<div class="section-head"><div><h2>Plantillas prerrellenas</h2><p class="hint">Configura los textos que aparecerán al crear una nota de intervención.</p></div></div>
      <form id="template-form" class="form-grid">
        <input type="hidden" name="id">
        <div class="field"><label for="template-title">Título de la plantilla *</label><input id="template-title" name="title" required maxlength="80" placeholder="Ej.: Revisión anual"></div>
        <div class="field"><label for="template-type">Tipo de intervención *</label><select id="template-type" name="type"><option>${TYPES.general}</option><option>${TYPES.asm}</option></select></div>
        <div id="template-general-fields" class="field full"><label for="template-incident">Incidencia comunicada o detectada</label><textarea id="template-incident" name="incident" rows="4"></textarea><fieldset class="template-checks"><legend>Tipo de intervención</legend>${GENERAL_CHECKS.map((label, index) => `<label class="check"><input type="checkbox" name="generalCheck${index}"> ${label}</label>`).join('')}</fieldset><label for="template-other-type">Texto de Otros</label><input id="template-other-type" name="otherType" type="text" placeholder="Se muestra al marcar Otros"><label for="template-work">Trabajos realizados</label><textarea id="template-work" name="work" rows="4"></textarea><div class="report-template-options"><label class="check report-template-toggle"><input id="template-generate-report" type="checkbox" name="generateReport"> Generar informe</label><div class="report-title-field"><label for="template-report-title">Título del informe</label><input id="template-report-title" name="reportTitle" type="text" maxlength="120" value="${DEFAULT_REPORT_TITLE}" placeholder="Ej.: INFORME DE REVISIÓN"></div></div></div>
        <div id="template-asm-fields" class="field full" hidden><label class="check"><input type="checkbox" name="applicationOther"> Aplicación del detector: Otro</label><label for="template-application-other">Texto de Otro</label><input id="template-application-other" name="applicationOtherInfo" type="text" placeholder="Se muestra al marcar Otro"></div>
        <div class="field full"><label for="template-notes">Notas</label><textarea id="template-notes" name="notes" rows="4"></textarea></div>
        <div class="actions full"><button class="button primary" type="submit">Guardar plantilla</button><button class="button" type="button" data-clear-template>Limpiar</button></div>
      </form>
      <div class="template-list" aria-live="polite"></div>`;
    main.appendChild(panel);
    bindPanel(panel);
    renderTemplateList(panel, data.templates);
  }

  function renderTemplateList(panel, templates) {
    const list = panel.querySelector('.template-list');
    list.innerHTML = templates.length ? templates.map((template) => `<article class="template-row"><div><b>${esc(typeLabel(template.type))} - ${esc(template.title)}</b><span class="hint">${template.type === TYPES.asm ? 'Preconfigura Notas' : 'Preconfigura incidencia, tipo, trabajos y notas'}</span></div><div class="actions"><button class="button small" type="button" data-edit-template="${esc(template.id)}">Editar</button><button class="button small danger" type="button" data-delete-template="${esc(template.id)}">Eliminar</button></div></article>`).join('') : '<p class="muted">No hay plantillas configuradas.</p>';
  }

  function toggleGeneralFields(panel) {
    const isGeneral = panel.querySelector('[name="type"]').value === TYPES.general;
    panel.querySelector('#template-general-fields').hidden = !isGeneral;
    panel.querySelector('#template-asm-fields').hidden = isGeneral;
  }

  function toggleReportTitle(panel) {
    const checkbox = panel.querySelector('[name="generateReport"]');
    const title = panel.querySelector('[name="reportTitle"]');
    if (!checkbox || !title) return;
    title.readOnly = !checkbox.checked;
    title.setAttribute('aria-disabled', String(!checkbox.checked));
    title.classList.toggle('is-readonly', !checkbox.checked);
  }

  function fillForm(panel, template) {
    const form = panel.querySelector('#template-form');
    form.elements.id.value = template?.id || '';
    form.elements.title.value = template?.title || '';
    form.elements.type.value = typeLabel(template?.type);
    form.elements.incident.value = template?.incident || '';
    form.elements.work.value = template?.work || '';
    form.elements.notes.value = template?.notes || '';
    form.elements.otherType.value = template?.otherType || '';
    form.elements.generateReport.checked = Boolean(template?.generateReport);
    form.elements.reportTitle.value = template?.reportTitle || DEFAULT_REPORT_TITLE;
    form.elements.applicationOtherInfo.value = template?.applicationOtherInfo || '';
    form.elements.applicationOther.checked = Boolean(template?.applicationOther || template?.applicationOtherInfo);
    const selected = new Set((template?.generalChecks || []).map(String));
    GENERAL_CHECKS.forEach((_, index) => { form.elements[`generalCheck${index}`].checked = selected.has(String(index)); });
    toggleGeneralFields(panel);
    toggleReportTitle(panel);
    form.elements.title.focus();
  }

  function bindPanel(panel) {
    const form = panel.querySelector('#template-form');
    form.elements.type.addEventListener('change', () => toggleGeneralFields(panel));
    form.elements.generateReport.addEventListener('change', () => toggleReportTitle(panel));
    panel.querySelector('[data-clear-template]').addEventListener('click', () => fillForm(panel, null));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form).entries());
      const title = String(values.title || '').trim();
      if (!title) return;
      const data = read();
      const template = {
        id: values.id || `template-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        type: typeLabel(values.type),
        incident: values.incident || '',
        work: values.work || '',
        notes: values.notes || '',
        otherType: values.otherType || '',
        generateReport: values.generateReport === 'on',
        reportTitle: String(values.reportTitle || DEFAULT_REPORT_TITLE).trim() || DEFAULT_REPORT_TITLE,
        applicationOther: Boolean(values.applicationOther),
        applicationOtherInfo: values.applicationOtherInfo || '',
        generalChecks: GENERAL_CHECKS.map((_, index) => values[`generalCheck${index}`] ? String(index) : '').filter(Boolean),
        updated: new Date().toISOString()
      };
      const index = data.templates.findIndex((item) => item.id === template.id);
      if (index >= 0) data.templates[index] = template; else data.templates.unshift(template);
      save(data);
      fillForm(panel, null);
      renderTemplateList(panel, data.templates);
      window.dispatchEvent(new CustomEvent('intervention-templates-updated'));
    });
    panel.addEventListener('click', (event) => {
      const edit = event.target.closest('[data-edit-template]');
      const remove = event.target.closest('[data-delete-template]');
      const data = read();
      if (edit) fillForm(panel, data.templates.find((item) => item.id === edit.dataset.editTemplate));
      if (remove) {
        const template = data.templates.find((item) => item.id === remove.dataset.deleteTemplate);
        if (!template || !window.confirm(`¿Eliminar la plantilla "${template.title}"?`)) return;
        data.templates = data.templates.filter((item) => item.id !== remove.dataset.deleteTemplate);
        save(data);
        renderTemplateList(panel, data.templates);
        window.dispatchEvent(new CustomEvent('intervention-templates-updated'));
      }
    });
    toggleGeneralFields(panel);
    toggleReportTitle(panel);
  }

  function templateValues(template) {
    if (!template) return {};
    return template.type === TYPES.asm ? { notes: template.notes || '', applicationOther: template.applicationOther, applicationOtherInfo: template.applicationOtherInfo || '' } : {
      incident: template.incident || '',
      work: template.work || '',
      notes: template.notes || '',
      generateReport: Boolean(template.generateReport),
      reportTitle: template.reportTitle || DEFAULT_REPORT_TITLE,
      generalChecks: template.generalChecks || [],
      otherType: template.otherType || ''
    };
  }

  function applyTemplate(form, template) {
    const values = templateValues(template);
    const set = (name, value) => { const field = form.elements[name]; if (field) field.value = value || ''; };
    set('incident', values.incident);
    set('work', values.work);
    set('notes', values.notes);
    set('otherType', values.otherType);
    set('reportTitle', values.reportTitle);
    const generateReport = form.elements.generateReport;
    if (generateReport) generateReport.value = values.generateReport ? 'true' : '';
    set('applicationOtherInfo', values.applicationOtherInfo);
    const checks = new Set((values.generalChecks || []).map(String));
    GENERAL_CHECKS.forEach((_, index) => {
      const field = form.elements[`generalCheck${index}`];
      if (field) field.checked = checks.has(String(index));
    });
    const generalOther = form.elements.generalCheck3;
    if (generalOther) {
      generalOther.checked = checks.has('3');
      generalOther.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const applicationOther = form.elements.application4;
    if (applicationOther) {
      applicationOther.checked = Boolean(values.applicationOther || values.applicationOtherInfo);
      applicationOther.dispatchEvent(new Event('change', { bubbles: true }));
    }
    window.setTimeout(() => { set('otherType', values.otherType); set('applicationOtherInfo', values.applicationOtherInfo); }, 0);
  }

  function enhanceOrder() {
    const form = document.querySelector('#order-form');
    const select = form?.querySelector('#order-type');
    if (!form || !select || select.dataset.templatesReady) return;
    select.dataset.templatesReady = '1';
    read().templates.forEach((template) => {
      if (select.querySelector(`option[data-template-id="${template.id}"]`)) return;
      const option = document.createElement('option');
      option.value = template.type;
      option.textContent = `${typeLabel(template.type)} - ${template.title}`;
      option.dataset.templateId = template.id;
      select.appendChild(option);
    });
    let hidden = form.querySelector('#template-id');
    if (!hidden) {
      hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = 'templateId';
      hidden.id = 'template-id';
      form.prepend(hidden);
    }
    const ensureHidden = (name, id) => {
      let field = form.querySelector(`#${id}`);
      if (field) return field;
      field = document.createElement('input');
      field.type = 'hidden';
      field.name = name;
      field.id = id;
      form.prepend(field);
      return field;
    };
    ensureHidden('generateReport', 'template-generate-report-value');
    ensureHidden('reportTitle', 'template-report-title-value');
    select.addEventListener('change', () => {
      const option = select.options[select.selectedIndex];
      hidden.value = option.dataset.templateId || '';
      window.setTimeout(() => applyTemplate(form, read().templates.find((template) => template.id === hidden.value)), 0);
    });
  }

  function refreshOrderOptions() {
    const select = document.querySelector('#order-type');
    if (!select) return;
    const current = select.value;
    select.querySelectorAll('option[data-template-id]').forEach((option) => option.remove());
    read().templates.forEach((template) => {
      const option = document.createElement('option');
      option.value = template.type;
      option.textContent = `${typeLabel(template.type)} - ${template.title}`;
      option.dataset.templateId = template.id;
      select.appendChild(option);
    });
    select.value = current;
  }

  window.addEventListener('app-rendered', () => { renderSettings(); enhanceOrder(); });
  window.addEventListener('hashchange', () => setTimeout(() => { renderSettings(); enhanceOrder(); }, 0));
  window.addEventListener('intervention-templates-updated', refreshOrderOptions);
  renderSettings();
  enhanceOrder();
}());
