const CACHE_NAME = 'sat-mantenimientos-v1.0.50';
const APP_SHELL = [
  './index.html',
  './manifest.webmanifest?v=1.0.50',
  './app.css?v=1.0.50',
  './v2-final.css?v=1.0.50',
  './city-list.css?v=1.0.50',
  './config-v2.css?v=1.0.50',
  './incident-visibility.css?v=1.0.50',
  './sharing-v1.css?v=1.0.50',
  './interface-actions.css?v=1.0.50',
  './asm-rules.css?v=1.0.50',
  './intervention-templates.css?v=1.0.50',
  './configuration-layout.css?v=1.0.50',
  './visit-transfer.css?v=1.0.50',
  './model-brand-catalog.css?v=1.0.50',
  './signature-modal.css?v=1.0.50',
  './pwa-install.css?v=1.0.50',
  './text-capacity.js?v=1.0.50',
  './app-main.js?v=1.0.50',
  './intervention-templates.js?v=1.0.50',
  './order-defaults.js?v=1.0.50',
  './general-other-control.js?v=1.0.50',
  './asm-rules.js?v=1.0.50',
  './batch-signing-ui.js?v=1.0.50',
  './sharing-v1.js?v=1.0.50',
  './configuration-v2.js?v=1.0.50',
  './exclusive-options.js?v=1.0.50',
  './configuration-fields.js?v=1.0.50',
  './technician-defaults.js?v=1.0.50',
  './technician-workflow.js?v=1.0.50',
  './interface-actions.js?v=1.0.50',
  './asm-form-controls.js?v=1.0.50',
  './work-hours-control.js?v=1.0.50',
  './configuration-layout.js?v=1.0.50',
  './pwa-install.js?v=1.0.50',
  './visit-transfer.js?v=1.0.50',
  './model-brand-catalog.js?v=1.0.50',
  './location-autofill.js?v=1.0.50',
  './vendor/html2pdf.bundle.min.js?v=1.0.50',
  './core/domain/constants.js?v=1.0.50',
  './core/domain/date-time.js?v=1.0.50',
  './core/domain/store.js?v=1.0.50',
  './core/domain/schema.js?v=1.0.50',
  './core/domain/transfer.js?v=1.0.50',
  './core/domain/signatures.js?v=1.0.50',
  './core/domain/version.js?v=1.0.50',
  './data/municipalities.js?v=1.0.50',
  './normal-report-template.html',
  './notas-intervencion/nota-intervencion-asm-v10.html',
  './notas-intervencion/nota-intervencion-general-v10.html',
  './propuestas/general-intervention-report.html',
  './informes/asm-report-template.css',
  './informes/asm2/asmii-report-template.html',
  './informes/asm3/asmiii-report-template.html',
  './informes/asm4/asmiv-report-template.html',
  './informes/asmse/asmse-report-template.html',
  '../assets/icono-atfisica-A.png',
  '../assets/logo-ATSA-1-1.svg',
  '../assets/logo-horizontal-light.png',
  '../assets/symbol-official.png',
  '../assets/Montserrat-Regular.ttf',
  '../assets/Montserrat-Bold.ttf',
  '../assets/Roboto-Regular.ttf',
  '../assets/Roboto-Bold.ttf',
  './icono-at-intervenciones-preview.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((cached) => cached || caches.match(request, { ignoreSearch: true }))
      .then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      }))
  );
});
