(function () {
  'use strict';

  const KEY = 'notas-at-data-v1';
  const DEFAULT_BRANDS = ['Thermo Fisher Scientific'];

  function readData() {
    if (window.appStore?.read) return window.appStore.read();
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
  }

  function writeData(data) {
    if (window.appStore?.write) { window.appStore.write(data); return; }
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function clean(value) {
    return String(value ?? '').trim();
  }

  function key(name, brand) {
    return `${clean(brand).toLocaleLowerCase()}\u0000${clean(name).toLocaleLowerCase()}`;
  }

  function modelEntries(data) {
    const entries = [];
    const seen = new Set();
    const add = (name, brand = '') => {
      name = clean(name);
      brand = clean(brand);
      if (!name || seen.has(key(name, brand))) return;
      seen.add(key(name, brand));
      entries.push({ name, brand });
    };
    (Array.isArray(data.modelCatalog) ? data.modelCatalog : []).forEach((entry) => {
      if (typeof entry === 'string') add(entry);
      else if (entry) add(entry.name || entry.model, entry.brand || entry.brandName);
    });
    const catalogNames = new Set(entries.map((entry) => entry.name.toLocaleLowerCase()));
    (Array.isArray(data.models) ? data.models : []).forEach((entry) => {
      const name = typeof entry === 'string' ? entry : entry?.name || entry?.model;
      if (catalogNames.has(clean(name).toLocaleLowerCase())) return;
      add(name, typeof entry === 'string' ? '' : entry?.brand || entry?.brandName);
    });
    const brandedNames = new Set(entries.filter((entry) => entry.brand).map((entry) => entry.name.toLocaleLowerCase()));
    return entries.filter((entry) => entry.brand || !brandedNames.has(entry.name.toLocaleLowerCase()));
  }

  function brandValues(data, entries = modelEntries(data)) {
    const values = [];
    const seen = new Set();
    [...DEFAULT_BRANDS, ...(Array.isArray(data.brands) ? data.brands : []), ...entries.map((entry) => entry.brand)]
      .map(clean)
      .filter((value) => value && value !== 'Otra / no identificada')
      .forEach((value) => {
        const normalized = value.toLocaleLowerCase();
        if (seen.has(normalized)) return;
        seen.add(normalized);
        values.push(value);
      });
    return values;
  }

  function normalizeData(data) {
    const entries = modelEntries(data);
    data.modelCatalog = entries;
    data.models = [...new Set(entries.map((entry) => entry.name))];
    data.brands = Array.isArray(data.brands) ? data.brands : [];
    entries.forEach((entry) => {
      if (!entry.brand || data.brands.some((brand) => clean(brand).toLocaleLowerCase() === entry.brand.toLocaleLowerCase())) return;
      data.brands.push(entry.brand);
    });
    return data;
  }

  function notify(message) {
    const toast = document.querySelector('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function renderModelOptions(data, selected = '') {
    return `<option value="">Sin marca asignada</option>${brandValues(data).map((brand) => `<option value="${esc(brand)}"${brand.toLocaleLowerCase() === clean(selected).toLocaleLowerCase() ? ' selected' : ''}>${esc(brand)}</option>`).join('')}`;
  }

  function renderModelCatalog(block, data) {
    const entries = modelEntries(data);
    block.dataset.modelCatalogMounted = '1';
    block.innerHTML = `<h3>Modelos por marca</h3><p class="hint">Asocia cada modelo a una marca. En la nota normal seguirás pudiendo escribir valores nuevos.</p><div class="model-catalog-controls"><select id="add-model-brand" aria-label="Marca del nuevo modelo">${renderModelOptions(data)}</select><input id="add-model" placeholder="Añadir modelo" autocomplete="off"><button class="button small" type="button" data-add-model>Añadir</button></div><div class="mini-list">${entries.map((entry, index) => `<div class="model-catalog-row"><div class="model-catalog-name"><b>${esc(entry.name)}</b><span>${esc(entry.brand || 'Sin marca asignada')}</span></div><div class="model-catalog-actions"><select data-model-brand-index="${index}" aria-label="Marca de ${esc(entry.name)}">${renderModelOptions(data, entry.brand)}</select><button class="button small danger" type="button" data-remove-model="${index}" aria-label="Eliminar ${esc(entry.name)}">Eliminar</button></div></div>`).join('') || '<span class="muted">Sin modelos guardados</span>'}</div>`;
  }

  function mountModelCatalog() {
    if (location.hash !== '#configuracion') return;
    const block = document.querySelector('.catalog-model');
    if (!block) return;
    const data = normalizeData(readData());
    writeData(data);
    if (block.dataset.modelCatalogMounted !== '1') renderModelCatalog(block, data);
  }

  function updateBrandList(form, data, entries) {
    const list = form.querySelector('#brands');
    if (!list) return;
    const html = brandValues(data, entries).map((brand) => `<option value="${esc(brand)}"></option>`).join('');
    if (list.innerHTML !== html) list.innerHTML = html;
  }

  function updateModelList(form, data, entries) {
    const list = form.querySelector('#models');
    const brand = clean(form.querySelector('input[name="brand"]')?.value);
    if (!list) return;
    const matching = brand
      ? entries.filter((entry) => entry.brand && entry.brand.toLocaleLowerCase() === brand.toLocaleLowerCase())
      : entries;
    const byName = new Map();
    matching.forEach((entry) => { if (!byName.has(entry.name.toLocaleLowerCase())) byName.set(entry.name.toLocaleLowerCase(), entry); });
    const html = [...byName.values()].map((entry) => `<option value="${esc(entry.name)}"${entry.brand ? ` label="${esc(entry.brand)}"` : ''}></option>`).join('');
    if (list.innerHTML !== html) list.innerHTML = html;
  }

  function refreshNormalOrder(form) {
    if (!form || form.querySelector('#order-type')?.value === 'ASM / Mantenimiento') return;
    const data = normalizeData(readData());
    const entries = modelEntries(data);
    updateBrandList(form, data, entries);
    updateModelList(form, data, entries);
  }

  function refresh() {
    mountModelCatalog();
    refreshNormalOrder(document.querySelector('#order-form'));
  }

  document.addEventListener('click', (event) => {
    const add = event.target.closest('[data-add-model]');
    const remove = event.target.closest('[data-remove-model]');
    if (add) {
      const block = add.closest('.catalog-model');
      const input = block?.querySelector('#add-model');
      const brandSelect = block?.querySelector('#add-model-brand');
      const name = clean(input?.value);
      const brand = clean(brandSelect?.value);
      if (!name) return;
      const data = normalizeData(readData());
      const entries = modelEntries(data);
      if (entries.some((entry) => key(entry.name, entry.brand) === key(name, brand))) {
        notify('Ese modelo ya está asociado a esa marca');
        return;
      }
      data.modelCatalog.unshift({ name, brand });
      normalizeData(data);
      writeData(data);
      renderModelCatalog(block, data);
      notify('Modelo guardado');
      return;
    }
    if (remove) {
      const data = normalizeData(readData());
      const entries = modelEntries(data);
      const index = Number(remove.dataset.removeModel);
      if (!entries[index]) return;
      entries.splice(index, 1);
      data.modelCatalog = entries;
      // `models` es el formato legado que todavía consumen copias antiguas.
      // Hay que sincronizarlo antes de normalizar o el modelo eliminado se
      // volvería a reconstruir desde esa lista en la misma operación.
      data.models = entries.map((entry) => entry.name);
      normalizeData(data);
      writeData(data);
      renderModelCatalog(remove.closest('.catalog-model'), data);
      notify('Modelo eliminado del catálogo');
    }
  });

  document.addEventListener('change', (event) => {
    const brandIndex = event.target.closest('[data-model-brand-index]');
    if (brandIndex) {
      const data = normalizeData(readData());
      const entries = modelEntries(data);
      const index = Number(brandIndex.dataset.modelBrandIndex);
      if (!entries[index]) return;
      entries[index].brand = clean(brandIndex.value);
      data.modelCatalog = entries;
      normalizeData(data);
      writeData(data);
      renderModelCatalog(brandIndex.closest('.catalog-model'), data);
      notify('Marca del modelo actualizada');
      return;
    }
    if (event.target.matches('#order-form input[name="brand"]')) refreshNormalOrder(event.target.form);
    if (event.target.matches('#order-form #order-type')) refresh();
  });

  document.addEventListener('input', (event) => {
    if (event.target.matches('#order-form input[name="brand"]')) refreshNormalOrder(event.target.form);
  });

  window.addEventListener('app-rendered', refresh);
  window.addEventListener('hashchange', () => window.setTimeout(refresh, 0));
  const initial = normalizeData(readData());
  // Este script clásico puede ejecutarse antes que el módulo principal. No escribas
  // un fallback vacío en esa ventana: podría pisar datos corruptos antes de que el
  // store central los respalde y los recupere.
  if (window.appStore?.write) writeData(initial);
  window.setTimeout(refresh, 0);
}());
