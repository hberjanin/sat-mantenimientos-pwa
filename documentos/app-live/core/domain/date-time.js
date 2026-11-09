/**
 * Utilidades de fecha y hora locales.
 *
 * `Date#toISOString()` siempre representa UTC. La interfaz, en cambio, pide la hora
 * que ve la persona en el dispositivo. Por eso este modulo construye expresamente cada
 * componente local y evita el desfase de dia que aparece cerca de medianoche.
 */

const twoDigits = (value) => String(value).padStart(2, '0');

export function localDateTimeParts(date = new Date()) {
  return {
    date: `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`,
    time: `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`
  };
}

export function localDateTimeValue(date = new Date()) {
  const parts = localDateTimeParts(date);
  return `${parts.date}T${parts.time}`;
}

export function localDateValue(date = new Date()) {
  return localDateTimeParts(date).date;
}

export function normalizeFormDateTime(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  // Se conserva el formato completo que ya utilizan las notas existentes.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) return text;
  // Las versiones antiguas pueden contener solo hora; no se inventa una fecha.
  if (/^\d{2}:\d{2}$/.test(text)) return text;
  return text;
}

export function formatDate(value) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : 'Sin fecha';
}

export function formatDateTime(value) {
  const text = normalizeFormDateTime(value);
  const full = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (full) return `${full[3]}/${full[2]}/${full[1]} ${full[4]}:${full[5]}`;
  return text;
}

export function isoNow(clock = new Date()) {
  return clock.toISOString();
}
