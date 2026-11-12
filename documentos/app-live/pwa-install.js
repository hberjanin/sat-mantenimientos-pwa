(function () {
  'use strict';

  let deferredPrompt = null;

  function isStandalone() {
    return Boolean(window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true);
  }

  function controls() {
    return {
      install: document.querySelector('[data-install-pwa]'),
      status: document.querySelector('[data-pwa-status]')
    };
  }

  function refresh() {
    const { install, status } = controls();
    if (!install) return;
    const standalone = isStandalone();
    install.disabled = standalone;
    install.setAttribute('aria-disabled', String(standalone));
    install.textContent = standalone ? 'Aplicación instalada' : 'Instalar aplicación';
    if (!status) return;
    status.textContent = standalone
      ? 'La aplicación está instalada en este dispositivo.'
      : deferredPrompt
        ? 'La aplicación está lista para instalarse.'
        : 'La instalación depende de las opciones que ofrezca el navegador.';
  }

  function showHelp(title, content) {
    if (window.showAppModal) {
      window.showAppModal(`<h2>${title}</h2>${content}<div class="modal-actions"><button type="button" class="button" data-close>Cerrar</button></div>`);
      return;
    }
    window.alert(`${title}\n\n${content.replace(/<[^>]+>/g, ' ')}`);
  }

  async function install() {
    if (isStandalone()) return;
    if (!deferredPrompt) {
      showHelp('Instalar aplicación', '<p>Este navegador todavía no ofrece el diálogo de instalación. En Chrome o Edge, abre el menú del navegador y elige <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.</p>');
      return;
    }
    const prompt = deferredPrompt;
    deferredPrompt = null;
    await prompt.prompt();
    await prompt.userChoice.catch(() => null);
    refresh();
  }

  function uninstall() {
    showHelp('Desinstalar aplicación', '<p>La web no puede desinstalar una PWA de forma automática porque los navegadores no ofrecen una API estándar para ello.</p><p>En Chrome o Edge, abre el menú de la aplicación instalada y selecciona <strong>Desinstalar Notas de intervención</strong>. En móviles, mantén pulsado el icono y elige <strong>Desinstalar</strong> o <strong>Eliminar aplicación</strong>.</p>');
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    refresh();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    refresh();
  });
  window.addEventListener('app-rendered', refresh);
  document.addEventListener('click', (event) => {
    const installButton = event.target.closest('[data-install-pwa]');
    const uninstallButton = event.target.closest('[data-uninstall-pwa]');
    if (installButton) {
      event.preventDefault();
      install();
    } else if (uninstallButton) {
      event.preventDefault();
      uninstall();
    }
  });

  refresh();
}());
