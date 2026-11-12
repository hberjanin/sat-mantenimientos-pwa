/**
 * Sugiere la ciudad de firma a partir de la ubicación del dispositivo.
 *
 * La consulta solo se inicia al entrar en Configuración. El navegador gestiona
 * el permiso de GPS; si lo deniega, la ciudad manual sigue funcionando igual.
 */

const MAXIMUM_AGE_MS = 15 * 60 * 1000;
let locationAttempted = false;

function positionFromBrowser() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Este navegador no ofrece geolocalización'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: MAXIMUM_AGE_MS,
      timeout: 10_000
    });
  });
}

function nearestMunicipality(municipalities, latitude, longitude) {
  let nearest = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  const latitudeFactor = Math.cos(latitude * Math.PI / 180);
  for (const municipality of municipalities) {
    const [name, province, ineCode, cityLatitude, cityLongitude] = municipality;
    if (!Number.isFinite(cityLatitude) || !Number.isFinite(cityLongitude)) continue;
    const latitudeDistance = (cityLatitude - latitude);
    const longitudeDistance = (cityLongitude - longitude) * latitudeFactor;
    const distance = latitudeDistance ** 2 + longitudeDistance ** 2;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = { name, province, ineCode };
    }
  }
  return nearest;
}

function updateStatus(message) {
  const status = document.querySelector('#report-location-status');
  if (status) status.textContent = message;
}

async function suggestReportCity(input) {
  updateStatus('Obteniendo ubicación para sugerir la ciudad…');
  try {
    const [{ MUNICIPALITIES }, position] = await Promise.all([
      import('./data/municipalities.js?v=1.0.47'),
      positionFromBrowser()
    ]);
    const { latitude, longitude } = position.coords;
    const nearest = nearestMunicipality(MUNICIPALITIES, latitude, longitude);
    if (!nearest) throw new Error('No hay un municipio cercano en el catálogo local');

    const currentValue = input.value.trim();
    const userEdited = input.dataset.userEdited === 'true';
    const canSuggest = !userEdited && (!currentValue || currentValue === 'Madrid' || input.dataset.gpsSuggested === 'true');
    if (!canSuggest) {
      updateStatus(`Ubicación detectada cerca de ${nearest.name}; se conserva la ciudad editada.`);
      return;
    }

    input.value = nearest.name;
    input.dataset.gpsSuggested = 'true';
    window.appStore?.update((data) => {
      data.reportCity = nearest.name;
      if (!data.cities.some((city) => city.toLocaleLowerCase() === nearest.name.toLocaleLowerCase())) data.cities.push(nearest.name);
      return data;
    });
    updateStatus(`Ciudad sugerida por GPS: ${nearest.name}. Puedes editarla.`);
  } catch (error) {
    console.info('No se pudo sugerir la ciudad por GPS:', error.message || error);
    updateStatus('No se pudo obtener la ciudad automáticamente. Puedes escribirla manualmente.');
  }
}

function enhance(event) {
  if (event?.detail?.route && event.detail.route !== 'configuracion') return;
  const input = document.querySelector('#set-report-city');
  if (!input || input.dataset.locationReady) return;
  input.dataset.locationReady = 'true';
  input.addEventListener('input', () => { input.dataset.userEdited = 'true'; }, { passive: true });
  if (locationAttempted) return;
  locationAttempted = true;
  suggestReportCity(input);
}

window.addEventListener('app-rendered', enhance);
enhance();
