(function () {
  'use strict';

  const SECTIONS = [
    ['perfil', 'Perfil y firma'],
    ['plantillas', 'Plantillas'],
    ['clientes', 'Clientes'],
    ['catalogos', 'Catálogos'],
    ['datos', 'Copias y datos']
  ];
  let activeSection = 'perfil';

  function directPanel(column, index) {
    if (!column) return null;
    return [...column.children].filter((child) => child.classList.contains('panel'))[index - 1] || null;
  }

  function activate(workspace, id) {
    activeSection = id;
    workspace.querySelectorAll('[data-config-section]').forEach((section) => {
      const active = section.dataset.configSection === id;
      section.hidden = !active;
    });
    workspace.querySelectorAll('[data-config-tab]').forEach((tab) => {
      const active = tab.dataset.configTab === id;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    workspace.dataset.activeSection = id;
  }

  function mount() {
    if (location.hash !== '#configuracion') return;
    const main = document.querySelector('#main');
    const oldLayout = main?.querySelector('.two-col');
    const templateManager = main?.querySelector('#template-manager');
    const clientManager = main?.querySelector('#client-manager');
    if (!main || !oldLayout || !templateManager || !clientManager || main.querySelector('.config-layout')) return;

    const columns = [...oldLayout.children];
    const profile = directPanel(columns[0], 1);
    const catalogs = directPanel(columns[0], 2);
    const dataPanel = columns[1]?.classList.contains('panel') ? columns[1] : directPanel(columns[1], 1);
    if (!profile || !catalogs || !dataPanel) return;

    const workspace = document.createElement('div');
    workspace.className = 'config-layout';
    workspace.innerHTML = `<nav class="config-tabs" aria-label="Apartados de configuración" role="tablist">${SECTIONS.map(([id, label], index) => `<button type="button" class="config-tab${index === 0 ? ' is-active' : ''}" data-config-tab="${id}" role="tab" aria-selected="${index === 0}" aria-controls="config-section-${id}" tabindex="${index === 0 ? '0' : '-1'}">${label}</button>`).join('')}</nav><div class="config-sections"><section class="config-section" id="config-section-perfil" data-config-section="perfil" role="tabpanel"></section><section class="config-section" id="config-section-plantillas" data-config-section="plantillas" role="tabpanel" hidden></section><section class="config-section" id="config-section-clientes" data-config-section="clientes" role="tabpanel" hidden></section><section class="config-section" id="config-section-catalogos" data-config-section="catalogos" role="tabpanel" hidden></section><section class="config-section" id="config-section-datos" data-config-section="datos" role="tabpanel" hidden></section></div>`;

    oldLayout.replaceWith(workspace);
    workspace.querySelector('#config-section-perfil').appendChild(profile);
    workspace.querySelector('#config-section-plantillas').appendChild(templateManager);
    workspace.querySelector('#config-section-clientes').appendChild(clientManager);
    workspace.querySelector('#config-section-catalogos').appendChild(catalogs);
    workspace.querySelector('#config-section-datos').appendChild(dataPanel);

    workspace.querySelectorAll('[data-config-tab]').forEach((tab) => {
      tab.addEventListener('click', () => activate(workspace, tab.dataset.configTab));
      tab.addEventListener('keydown', (event) => {
        if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const tabs = [...workspace.querySelectorAll('[data-config-tab]')];
        const current = tabs.indexOf(tab);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        tabs[next].focus();
        activate(workspace, tabs[next].dataset.configTab);
      });
    });
    activate(workspace, activeSection);
  }

  window.addEventListener('app-rendered', mount);
  window.addEventListener('hashchange', () => window.setTimeout(mount, 0));
  window.setTimeout(mount, 0);
}());
