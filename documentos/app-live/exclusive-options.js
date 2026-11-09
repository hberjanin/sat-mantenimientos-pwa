(function () {
  'use strict';

  function groupFor(name) {
    if (/^application\d+$/.test(name)) return 'application';
    if (/^generalCheck\d+$/.test(name)) return 'general-check';
    if (/^asmIncident(?:Yes|No)$/.test(name)) return 'asm-incident';
    if (/^asmCheck\d+(?:Yes|No|NA)$/.test(name)) return name.replace(/(?:Yes|No|NA)$/, '');
    if (/^s[12](?:Present|Working)(?:Yes|No)$/.test(name)) return name.replace(/(?:Yes|No)$/, '');
    return '';
  }

  function wire() {
    document.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach((input) => {
      const group = groupFor(input.name || '');
      if (!group) return;
      input.type = 'radio';
      input.dataset.exclusiveGroup = group;
      if (input.dataset.exclusiveBound) return;
      input.dataset.exclusiveBound = '1';
      input.addEventListener('change', () => {
        if (!input.checked) return;
        document.querySelectorAll('input[data-exclusive-group]').forEach((other) => {
          if (other !== input && other.dataset.exclusiveGroup === group) other.checked = false;
        });
      });
    });
  }

  window.addEventListener('app-rendered', wire);
  wire();
})();
