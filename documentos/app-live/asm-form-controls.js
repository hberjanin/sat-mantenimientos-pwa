(function () {
  'use strict';

  function currentAsmForm() {
    const form = document.querySelector('#order-form');
    return form?.querySelector('#order-type')?.value === 'ASM / Mantenimiento' ? form : null;
  }

  function syncOtherApplication(form) {
    const checkbox = form?.querySelector('input[name="application4"]');
    const checks = checkbox?.closest('.check-grid');
    if (!checkbox || !checks) return;

    let field = form.querySelector('#asm-application-other');
    if (!field) {
      field = document.createElement('div');
      field.id = 'asm-application-other';
      field.className = 'field v2-space';
      field.innerHTML = '<label for="asm-application-other-text">Especifica otro *</label><input id="asm-application-other-text" name="applicationOtherInfo" type="text" autocomplete="off">';
      checks.insertAdjacentElement('afterend', field);
    }

    const input = field.querySelector('input');
    const active = checkbox.checked;
    field.hidden = !active;
    input.disabled = !active;
    input.required = active;
  }

  function setDefaultIfEmpty(form, selector, preferredSuffix) {
    const options = [...form.querySelectorAll(selector)];
    if (options.length && !options.some((input) => input.checked) && !options.every((input) => input.disabled)) {
      const preferred = options.find((input) => input.name.endsWith(preferredSuffix));
      if (preferred && !preferred.disabled) preferred.checked = true;
    }
  }

  function syncDefaults(form) {
    if (!form) return;
    setDefaultIfEmpty(form, 'input[name="application0"], input[name="application1"], input[name="application2"], input[name="application3"], input[name="application4"]', 'application0');
    setDefaultIfEmpty(form, 'input[name="asmIncidentYes"], input[name="asmIncidentNo"]', 'No');
    ['0', '1', '2', '3'].forEach((index) => setDefaultIfEmpty(form, `input[name="asmCheck${index}Yes"], input[name="asmCheck${index}No"], input[name="asmCheck${index}NA"]`, 'Yes'));
    setDefaultIfEmpty(form, 'input[name="s1PresentYes"], input[name="s1PresentNo"]', 'PresentYes');
    setDefaultIfEmpty(form, 'input[name="s2PresentYes"], input[name="s2PresentNo"]', 'PresentYes');
    setDefaultIfEmpty(form, 'input[name="s1WorkingYes"], input[name="s1WorkingNo"]', 'WorkingYes');
    setDefaultIfEmpty(form, 'input[name="s2WorkingYes"], input[name="s2WorkingNo"]', 'WorkingYes');
  }

  function sync() {
    const form = currentAsmForm();
    if (!form) return;
    syncOtherApplication(form);
    syncDefaults(form);
  }

  document.addEventListener('change', (event) => {
    if (event.target.closest('#order-form')) window.setTimeout(sync, 0);
  });
  window.addEventListener('app-rendered', sync);
  window.setTimeout(sync, 0);
}());
