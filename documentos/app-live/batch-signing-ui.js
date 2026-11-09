(function () {
  'use strict';

  const KEY = 'notas-at-data-v1';

  function readData() {
    if (window.appStore?.read) return window.appStore.read();
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch {
      return { notes: [], visits: [] };
    }
  }

  function pendingCount(visitId) {
    const data = readData();
    return (data.notes || []).filter((note) => note.visitId === visitId && !note.deleted && note.status === 'pending').length;
  }

  function addButton(container, visitId, label, className) {
    if (!container || Array.from(container.querySelectorAll('[data-batch-sign]')).some((button) => button.dataset.batchSign === visitId)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.dataset.batchSign = visitId;
    button.textContent = label;
    const deleteButton = container.querySelector('.button.danger');
    if (deleteButton) container.insertBefore(button, deleteButton);
    else container.appendChild(button);
  }

  function enhance() {
    const hash = location.hash.slice(1).split('/');
    const view = hash[0];
    const visitId = hash[1];

    if (view === 'visita' && visitId) {
      const toolbar = document.querySelector('.toolbar');
      if (pendingCount(visitId) > 0) addButton(toolbar, visitId, 'Firmar todas las órdenes', 'button primary');
    }

    if (view === 'historial') {
      document.querySelectorAll('a[href^="#visita/"]').forEach((link) => {
        const id = link.getAttribute('href').slice('#visita/'.length);
        if (pendingCount(id) === 0) return;
        addButton(link.closest('.visit-card-head')?.querySelector('.actions'), id, 'Firmar órdenes', 'button small primary');
      });
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-batch-sign]');
    if (!button) return;
    event.preventDefault();
    if (typeof window.startBatchSigning === 'function') window.startBatchSigning(button.dataset.batchSign);
  });

  window.addEventListener('app-rendered', () => setTimeout(enhance, 0));
  window.addEventListener('hashchange', () => setTimeout(enhance, 0));
  setTimeout(enhance, 0);
})();
