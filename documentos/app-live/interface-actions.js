(function () {
  'use strict';

  const ACTIONS = {
    open: { icon: '↗', label: 'Abrir', title: 'Abrir intervención' },
    sign: { icon: '✎', label: 'Firma cliente', title: 'Firma cliente' },
    preview: { icon: '▣', label: 'Ver PDF', title: 'Ver PDF' },
    download: { icon: '↓', label: 'Descargar PDF', title: 'Descargar PDF' },
    send: { icon: '→', label: 'Enviar PDF', title: 'Enviar PDF' },
    sendVisit: { icon: '→', label: 'Enviar todas las notas', title: 'Enviar todas las notas' },
    delete: { icon: '×', label: 'Borrar', title: 'Borrar intervención' },
    deleteVisit: { icon: '×', label: 'Borrar visita', title: 'Borrar visita' }
  };

  function setAction(button, action) {
    if (!button || !action) return;
    if (button.dataset.interfaceAction === action.label && button.querySelector('.button-icon') && button.querySelector('.button-label')) return;
    button.dataset.interfaceAction = action.label;
    button.classList.add('icon-action');
    button.title = action.title;
    button.setAttribute('aria-label', action.title);
    button.innerHTML = `<span class="button-icon" aria-hidden="true">${action.icon}</span><span class="button-label">${action.label}</span>`;
  }

  function setDynamicAction(button, icon) {
    const label = button?.querySelector('.button-label')?.textContent?.trim() || button?.textContent?.trim();
    if (!label) return;
    setAction(button, { icon, label, title: label });
  }

  function addIndividualDeleteButtons() {
    document.querySelectorAll('[data-open-note]').forEach((openButton) => {
      const id = openButton.dataset.openNote;
      const actions = openButton.closest('.actions');
      if (!id || !actions || actions.querySelector(`[data-inline-delete-note="${id}"]`)) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button small danger icon-action';
      button.dataset.inlineDeleteNote = id;
      button.dataset.interfaceAction = ACTIONS.delete.label;
      button.title = ACTIONS.delete.title;
      button.setAttribute('aria-label', ACTIONS.delete.title);
      button.innerHTML = `<span class="button-icon" aria-hidden="true">${ACTIONS.delete.icon}</span><span class="button-label">${ACTIONS.delete.label}</span>`;
      actions.appendChild(button);
    });
  }

  function enhance() {
    addIndividualDeleteButtons();
    document.querySelectorAll('[data-open-note]').forEach((button) => setAction(button, ACTIONS.open));
    document.querySelectorAll('[data-sign-note]').forEach((button) => setAction(button, ACTIONS.sign));
    document.querySelectorAll('[data-sign-technician]').forEach((button) => setDynamicAction(button, '✎'));
    document.querySelectorAll('[data-batch-sign]').forEach((button) => setDynamicAction(button, '✎'));
    document.querySelectorAll('[data-preview-note]').forEach((button) => setAction(button, ACTIONS.preview));
    document.querySelectorAll('[data-download-note]').forEach((button) => setAction(button, ACTIONS.download));
    document.querySelectorAll('[data-share-note]').forEach((button) => setAction(button, ACTIONS.send));
    document.querySelectorAll('[data-share-visit]').forEach((button) => setAction(button, ACTIONS.sendVisit));
    document.querySelectorAll('[data-delete-visit]').forEach((button) => setAction(button, ACTIONS.deleteVisit));
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-inline-delete-note]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.deleteIntervention?.(button.dataset.inlineDeleteNote);
  }, true);

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    window.setTimeout(() => { queued = false; enhance(); }, 0);
  };
  window.addEventListener('app-rendered', schedule);
  window.addEventListener('hashchange', schedule);
  schedule();
})();
