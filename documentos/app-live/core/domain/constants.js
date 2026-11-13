/**
 * Reglas y valores compartidos por los casos de uso.
 *
 * Este modulo no conoce el DOM ni el navegador. Mantener las constantes fuera de los
 * renderizadores evita que una etiqueta visible y una regla de negocio evolucionen de
 * forma diferente.
 */

export const STORAGE_KEY = 'notas-at-data-v1';
export const STORAGE_CORRUPT_BACKUP_SUFFIX = '-corrupt-backup-v1';
export const TRANSFER_FORMAT = 'sat-visita';
export const TRANSFER_VERSION = 1;
export const MAX_TRANSFER_BYTES = 20 * 1024 * 1024;
export const DAY_MS = 24 * 60 * 60 * 1000;

export const INTERVENTION_TYPES = Object.freeze({
  GENERAL: 'Intervención general',
  ASM: 'ASM / Mantenimiento'
});

export const GENERAL_CHECKS = Object.freeze([
  'Instalación',
  'Mantenimiento',
  'Reparación',
  'Otros'
]);

export const ASM_CHECKS = Object.freeze([
  'Local Line Driver',
  'Interface con el PC',
  'Conversor RS232-RS485',
  'Sistema de impresión'
]);

export const DEFAULT_FOOTER_LINE_1 = 'División de Protección Radiológica y Física Médica';
export const DEFAULT_FOOTER_LINE_2 = 'Tel: +34 913 52 54 54 · Fax: +34 913 52 46 85 · Web: www.atfisica.com · E-mail: atfisica@atfisica.com';

export const ASM_FAMILIES = Object.freeze(['SE', 'II', 'III', 'IV']);

export const DEFAULT_PROVINCES = Object.freeze([
  'A Coruña', 'Álava', 'Albacete', 'Alicante', 'Almería', 'Asturias', 'Barcelona',
  'Bizkaia', 'Cádiz', 'Cantabria', 'Castellón', 'Ciudad Real', 'Córdoba', 'Cuenca',
  'Girona', 'Granada', 'Guadalajara', 'Gipuzkoa', 'Huelva', 'Huesca', 'Illes Balears',
  'Jaén', 'La Rioja', 'Las Palmas', 'León', 'Lleida', 'Lugo', 'Madrid', 'Málaga',
  'Murcia', 'Navarra', 'Ourense', 'Palencia', 'Pontevedra', 'Salamanca',
  'Santa Cruz de Tenerife', 'Segovia', 'Sevilla', 'Soria', 'Tarragona', 'Teruel',
  'Toledo', 'Valencia', 'Valladolid', 'Vizcaya', 'Zamora', 'Zaragoza'
]);

export const DEFAULT_CITIES = Object.freeze([
  'Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao', 'Málaga', 'Zaragoza',
  'A Coruña', 'Alicante', 'Murcia', 'Valladolid', 'Vigo'
]);

export const EMPTY_DATA = Object.freeze({
  notes: [],
  trash: [],
  visits: [],
  visitTrash: [],
  templates: [],
  clients: [],
  cities: DEFAULT_CITIES,
  provinces: DEFAULT_PROVINCES,
  brands: [],
  models: [],
  modelCatalog: [],
  technicianName: '',
  technicianEmail: '',
  technicianSignature: '',
  technician1Name: '',
  technician1Signature: '',
  technician2Name: '',
  technician2Signature: '',
  reportCity: '',
  footerLine1: DEFAULT_FOOTER_LINE_1,
  footerLine2: DEFAULT_FOOTER_LINE_2,
  lastClientSigner: '',
  lastClientEmail: ''
});
