(function () {
  'use strict';

  let deferredPrompt = null;
  let updateInProgress = false;
  let reloadAfterUpdate = false;

  function isStandalone() {
    return Boolean(window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true);
  }

  function controls() {
    return {
      install: document.querySelector('[data-install-pwa]'),
      status: document.querySelector('[data-pwa-status]'),
      update: document.querySelector('[data-update-pwa]'),
      updateStatus: document.querySelector('[data-pwa-update-status]')
    };
  }

  function refresh() {
    const { install, status, update, updateStatus } = controls();
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
    if (update) update.disabled = updateInProgress;
    if (updateStatus && !updateInProgress && !updateStatus.textContent) {
      updateStatus.textContent = 'Comprueba si hay una versión nueva disponible.';
    }
  }

  function setUpdateStatus(message) {
    const { updateStatus } = controls();
    if (updateStatus) updateStatus.textContent = message;
  }

  function waitForActivation(registration, candidate, previousWorker) {
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error('La actualización tardó demasiado en activarse.'));
      }, 30000);
      const finish = () => {
        cleanup();
        resolve();
      };
      const onControllerChange = () => {
        if (navigator.serviceWorker.controller !== previousWorker) finish();
      };
      const onStateChange = () => {
        if (registration.active && registration.active !== previousWorker && registration.active.state === 'activated') finish();
      };
      const cleanup = () => {
        window.clearTimeout(timeout);
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
        candidate?.removeEventListener('statechange', onStateChange);
      };

      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
      candidate?.addEventListener('statechange', onStateChange);
      if (registration.active && registration.active !== previousWorker) finish();
    });
  }

  async function updateApplication() {
    if (updateInProgress) return;
    if (!('serviceWorker' in navigator)) {
      setUpdateStatus('Este navegador no permite actualizar la aplicación automáticamente.');
      return;
    }

    updateInProgress = true;
    refresh();
    setUpdateStatus('Buscando una versión nueva...');

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) throw new Error('El servicio offline todavía no está activo.');
      const previousWorker = navigator.serviceWorker.controller || registration.active;
      await registration.update();

      const candidate = registration.installing || registration.waiting;
      if (!candidate && registration.active === previousWorker) {
        setUpdateStatus('La aplicación ya está actualizada.');
        return;
      }

      setUpdateStatus('Descargando e instalando la nueva versión...');
      if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      reloadAfterUpdate = true;
      await waitForActivation(registration, candidate, previousWorker);
      setUpdateStatus('Actualización instalada. Recargando...');
      reloadApplication();
    } catch (error) {
      reloadAfterUpdate = false;
      setUpdateStatus(`No se pudo actualizar: ${error.message}`);
    } finally {
      updateInProgress = false;
      refresh();
    }
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
  function reloadApplication() {
    if (!reloadAfterUpdate) return;
    reloadAfterUpdate = false;
    window.location.reload();
  }
  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    reloadApplication();
  });
  document.addEventListener('click', (event) => {
    const installButton = event.target.closest('[data-install-pwa]');
    const uninstallButton = event.target.closest('[data-uninstall-pwa]');
    const updateButton = event.target.closest('[data-update-pwa]');
    if (installButton) {
      event.preventDefault();
      install();
    } else if (uninstallButton) {
      event.preventDefault();
      uninstall();
    } else if (updateButton) {
      event.preventDefault();
      updateApplication();
    }
  });

  refresh();
}());
