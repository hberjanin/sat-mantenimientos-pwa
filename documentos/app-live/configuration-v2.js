(function () {
  'use strict';

  const KEY = 'notas-at-data-v1';

  function readData() {
    if (window.appStore?.read) return window.appStore.read();
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
  }

  function saveData(data) {
    if (window.appStore?.write) { window.appStore.write(data); return; }
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function askConfirm(title, message, confirmLabel = 'Confirmar') {
    return new Promise((resolve) => {
      const modal = document.querySelector('#modal');
      if (!modal) { resolve(false); return; }
      modal.innerHTML = `<div class="modal-card confirm-card" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><h2 id="confirm-title">${title}</h2><p>${message}</p><div class="modal-actions"><button type="button" class="button" data-confirm-no>Cancelar</button><button type="button" class="button danger" data-confirm-yes>${confirmLabel}</button></div></div>`;
      modal.hidden = false;
      const finish = (value) => { modal.hidden = true; modal.innerHTML = ''; resolve(value); };
      modal.querySelector('[data-confirm-no]').onclick = () => finish(false);
      modal.querySelector('[data-confirm-yes]').onclick = () => finish(true);
      modal.querySelector('[data-confirm-no]').focus();
    });
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function renderClientList(data) {
    const list = document.querySelector('#client-manager-list');
    if (!list) return;
    list.innerHTML = (data.clients || []).map((client, index) => `<div class="config-client-row"><div><b>${esc(client.name)}</b><span>${esc([client.city, client.province, client.country].filter(Boolean).join(' · '))}</span></div><div class="actions"><button class="button small" data-edit-client="${index}">Editar</button><button class="button small danger" data-delete-client="${index}">Eliminar</button></div></div>`).join('') || '<span class="muted">Sin clientes guardados</span>';
  }

  function mount() {
    if (location.hash !== '#configuracion' || document.querySelector('#client-manager')) return;
    const data = readData();
    data.clients = data.clients || [];
    data.provinces = data.provinces || [];
    const main = document.querySelector('#main');
    if (!main) return;
    const oldClientBlock = main.querySelector('.catalog-block');
    if (oldClientBlock) oldClientBlock.hidden = true;
    const wrapper = document.createElement('div');
    wrapper.className = 'panel config-v2-panel';
    wrapper.id = 'client-manager';
    wrapper.innerHTML = `<h2>Clientes completos</h2><form id="client-manager-form" class="form-grid"><input type="hidden" name="index" value=""><div class="field"><label>Nombre *</label><input name="name" required></div><div class="field"><label>Ciudad</label><input name="city"></div><div class="field"><label>Provincia</label><select name="province"><option value="">Seleccionar</option>${data.provinces.map((province) => `<option>${esc(province)}</option>`).join('')}</select></div><div class="field"><label>País</label><input name="country" value="España"></div><div class="actions full"><button class="button primary">Guardar cliente</button><button type="button" class="button" data-clear-client>Limpiar</button></div></form><div id="client-manager-list" class="config-client-list"></div>`;
    main.appendChild(wrapper);
    renderClientList(data);
  }

  document.addEventListener('submit', (event) => {
    if (event.target.id !== 'client-manager-form') return;
    event.preventDefault();
    const form = event.target;
    const values = Object.fromEntries(new FormData(form).entries());
    const data = readData();
    data.clients = data.clients || [];
    const client = { name: values.name.trim(), city: values.city.trim(), province: values.province, country: values.country.trim() || 'España' };
    if (!client.name) return;
    if (values.index === '') data.clients.push(client); else data.clients[Number(values.index)] = client;
    saveData(data);
    location.reload();
  }, true);

  document.addEventListener('click', (event) => {
    const edit = event.target.closest('[data-edit-client]');
    const remove = event.target.closest('[data-delete-client]');
    const clear = event.target.closest('[data-clear-client]');
    if (edit) {
      const client = (readData().clients || [])[Number(edit.dataset.editClient)];
      const form = document.querySelector('#client-manager-form');
      if (!client || !form) return;
      form.elements.index.value = edit.dataset.editClient;
      form.elements.name.value = client.name || '';
      form.elements.city.value = client.city || '';
      form.elements.province.value = client.province || '';
      form.elements.country.value = client.country || 'España';
    } else if (remove) {
      event.preventDefault();
      askConfirm('Eliminar cliente', 'Se quitará este cliente del catálogo.', 'Eliminar').then((confirmed) => {
        if (!confirmed) return;
        const data = readData();
        data.clients.splice(Number(remove.dataset.deleteClient), 1);
        saveData(data);
        location.reload();
      });
    } else if (clear) {
      const form = document.querySelector('#client-manager-form');
      if (form) { form.reset(); form.elements.index.value = ''; form.elements.country.value = 'España'; }
    }
  }, true);

  window.addEventListener('app-rendered', mount);
  window.addEventListener('hashchange', () => setTimeout(mount, 0));
  setTimeout(mount, 0);
})();
