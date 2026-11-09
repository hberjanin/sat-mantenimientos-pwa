(function () {
  'use strict';

  function syncOtherField() {
    const checkbox = document.querySelector('#type-fields input[name="generalCheck3"]');
    const checks = checkbox?.closest('.check-grid');
    if (!checkbox || !checks) return;

    let field = document.querySelector('#general-other-explanation');
    if (!field) {
      field = document.createElement('div');
      field.id = 'general-other-explanation';
      field.className = 'field full v2-space';
      field.innerHTML = '<label for="general-other-text">Especifica otros *</label><input id="general-other-text" name="otherType" type="text" autocomplete="off">';
      checks.insertAdjacentElement('afterend', field);
    }

    const input = field.querySelector('input');
    const active = checkbox.checked;
    field.hidden = !active;
    input.disabled = !active;
    input.required = active;
  }

  document.addEventListener('change', (event) => {
    if (event.target.matches('#type-fields input[name="generalCheck3"]')) syncOtherField();
  });

  window.addEventListener('app-rendered', syncOtherField);
  syncOtherField();
}());
