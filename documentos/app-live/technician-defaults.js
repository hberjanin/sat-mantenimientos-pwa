(function () {
  'use strict';

  const KEY = 'notas-at-data-v1';

  function savedName() {
    try {
      const data = window.appStore?.read ? window.appStore.read() : JSON.parse(localStorage.getItem(KEY) || '{}');
      const visitId = location.hash.match(/^#orden\/([^/]+)/)?.[1];
      const currentVisit = (data.visits || []).find((visit) => visit.id === visitId);
      const latestVisit = (data.visits || []).find((visit) => String(visit.technician || '').trim());
      const latestNote = (data.notes || []).find((note) => String(note.technician || '').trim());
      return String(data.technician1Name || data.technicianName || currentVisit?.technician || latestVisit?.technician || latestNote?.technician || '').trim();
    } catch {
      return '';
    }
  }

  function apply(root = document) {
    const name = savedName();
    if (!name) return;
    root.querySelectorAll?.('input[name="technician"]').forEach((input) => {
      if (!input.value.trim()) {
        input.value = name;
        input.dataset.defaultTechnician = '1';
      }
    });
    root.querySelectorAll?.('.batch-review p').forEach((paragraph) => {
      const text = paragraph.textContent || '';
      const marker = '· Inicio:';
      if (text.startsWith('Técnicos:') && text.includes(marker) && !text.slice(10, text.indexOf(marker)).trim()) {
        paragraph.textContent = `Técnicos: ${name} ${text.slice(text.indexOf(marker))}`;
      }
    });
  }

  document.addEventListener('submit', (event) => {
    const name = savedName();
    if (!name) return;
    event.target.querySelectorAll?.('input[name="technician"]').forEach((input) => {
      if (!input.value.trim()) input.value = name;
    });
  }, true);

  window.addEventListener('app-rendered', apply);
  apply();
})();
