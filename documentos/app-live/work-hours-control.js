(function () {
  'use strict';

  function normalForm() {
    const form = document.querySelector('#order-form');
    return form?.querySelector('#order-type')?.value === 'Intervención general' ? form : null;
  }

  function minutesOf(value) {
    const text = String(value || '');
    const match = text.match(/(?:T|\s)?(\d{2}):(\d{2})/);
    if (!match) return NaN;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function calculate(form) {
    const start = form?.querySelector('input[name="startTime"]');
    const end = form?.querySelector('input[name="endTime"]');
    const total = form?.querySelector('input[name="totalHours"]');
    if (!start || !end || !total || form.dataset.totalHoursManual === '1') return;
    if (!start.value || !end.value) {
      total.value = '';
      return;
    }

    let minutes = minutesOf(end.value) - minutesOf(start.value);
    if (!Number.isFinite(minutes)) return;
    const startDate = start.value.slice(0, 10);
    const endDate = end.value.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      const dayDelta = Math.round((Date.parse(`${endDate}T00:00:00`) - Date.parse(`${startDate}T00:00:00`)) / 86400000);
      minutes += dayDelta * 24 * 60;
    } else if (minutes < 0) {
      minutes += 24 * 60;
    }

    const hours = Math.floor(minutes / 60);
    const remainder = String(minutes % 60).padStart(2, '0');
    total.value = `${hours} h ${remainder} min`;
    total.dataset.calculated = '1';
  }

  function sync() {
    const form = normalForm();
    if (form) calculate(form);
  }

  document.addEventListener('input', (event) => {
    const form = normalForm();
    if (!form) return;
    if (event.target.matches('input[name="totalHours"]')) {
      if (event.target.value.trim()) form.dataset.totalHoursManual = '1';
      else delete form.dataset.totalHoursManual;
    } else if (event.target.matches('input[name="startTime"], input[name="endTime"]')) {
      calculate(form);
    }
  });
  document.addEventListener('change', (event) => {
    if (event.target.matches('input[name="startTime"], input[name="endTime"]')) sync();
  });
  window.addEventListener('app-rendered', sync);
  window.setTimeout(sync, 0);
}());
