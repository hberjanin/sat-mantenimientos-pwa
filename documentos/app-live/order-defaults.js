(function () {
  'use strict';

  function localDateTime() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  function syncStart(form) {
    const input = form?.querySelector('input[name="startTime"]');
    if (input && !input.value) {
      input.value = localDateTime();
      input.dataset.autoDefault = '1';
    }
  }

  function syncNotice(form) {
    const input = form?.querySelector('input[name="noticeTime"]');
    if (input && !input.value) {
      input.value = localDateTime();
      input.dataset.autoDefault = '1';
    }
  }

  function sync() {
    const form = document.querySelector('#order-form');
    if (form) {
      syncNotice(form);
      syncStart(form);
    }
  }

  document.addEventListener('input', (event) => {
    if (event.target.matches('#order-form input[name="startTime"]')) delete event.target.dataset.autoDefault;
    if (event.target.matches('#order-form input[name="noticeTime"]')) delete event.target.dataset.autoDefault;
    if (event.target.matches('#order-form input[name="endTime"]')) delete event.target.dataset.autoDefault;
  });
  document.addEventListener('submit', (event) => {
    const form = event.target.closest('#order-form');
    const end = form?.querySelector('input[name="endTime"]');
    if (end && !end.value) {
      end.value = localDateTime();
      end.dataset.autoDefault = '1';
    }
  }, true);
  window.addEventListener('app-rendered', sync);
  window.setTimeout(sync, 0);
}());
