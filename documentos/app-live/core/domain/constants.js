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
export const DEFAULT_CATALOG_VERSION = 1;

export const DEFAULT_BRANDS = Object.freeze([
  'Thermo Fisher Scientific',
  'LAP',
  'Elekta'
]);

export const DEFAULT_MODEL_CATALOG = Object.freeze([
  { brand: 'Thermo Fisher Scientific', name: 'ASM SE 1500' },
  { brand: 'Thermo Fisher Scientific', name: 'ASM SE 3000' },
  { brand: 'Thermo Fisher Scientific', name: 'ASM II 1500' },
  { brand: 'Thermo Fisher Scientific', name: 'ASM II 3000' },
  { brand: 'Thermo Fisher Scientific', name: 'ASM II 4500' },
  { brand: 'Thermo Fisher Scientific', name: 'ASM II 6000' },
  { brand: 'Thermo Fisher Scientific', name: 'ASM II 9000' },
  { brand: 'Thermo Fisher Scientific', name: 'ASM II 12000' },
  { brand: 'Thermo Fisher Scientific', name: 'ASM III 1500' },
  { brand: 'Thermo Fisher Scientific', name: 'ASM III 3000' },
  { brand: 'Thermo Fisher Scientific', name: 'ASM III 4500' },
  { brand: 'Thermo Fisher Scientific', name: 'ASM III 6000' },
  { brand: 'Thermo Fisher Scientific', name: 'ASM III 9000' },
  { brand: 'Thermo Fisher Scientific', name: 'ASM III 12000' },
  { brand: 'Thermo Fisher Scientific', name: 'ASM IV 1500' },
  { brand: 'Thermo Fisher Scientific', name: 'ASM IV 3000' },
  { brand: 'Thermo Fisher Scientific', name: 'ASM IV 4500' },
  { brand: 'Thermo Fisher Scientific', name: 'ASM IV 6000' },
  { brand: 'Thermo Fisher Scientific', name: 'ASM IV 9000' },
  { brand: 'Thermo Fisher Scientific', name: 'ASM IV 12000' },
  { brand: 'Thermo Fisher Scientific', name: 'ASM IV 18000' },
  { brand: 'Thermo Fisher Scientific', name: 'ASM IV 21000' },
  { brand: 'Thermo Fisher Scientific', name: 'ASM IV 24000' },
  { brand: 'LAP', name: 'DORADO 1' },
  { brand: 'LAP', name: 'DORADO 3' },
  { brand: 'LAP', name: 'DORADOnova 1' },
  { brand: 'LAP', name: 'DORADOnova 3' },
  { brand: 'LAP', name: 'DORADOnova 5' },
  { brand: 'LAP', name: 'DORADOnova MR3T' },
  { brand: 'LAP', name: 'APOLLO' },
  { brand: 'LAP', name: 'APOLLO MR3T' },
  { brand: 'LAP', name: 'ASTOR' },
  { brand: 'LAP', name: 'LUNA 3D' },
  { brand: 'Elekta', name: 'Axxent' }
]);

export const ASM_FAMILIES = Object.freeze(['SE', 'II', 'III', 'IV']);

export const DEFAULT_PROVINCES = Object.freeze([
  'A Coruña', 'Álava', 'Albacete', 'Alicante', 'Almería', 'Asturias', 'Ávila',
  'Badajoz', 'Barcelona', 'Bizkaia', 'Burgos', 'Cáceres', 'Cádiz', 'Cantabria',
  'Castellón', 'Ciudad Real', 'Córdoba', 'Cuenca', 'Girona', 'Granada',
  'Guadalajara', 'Gipuzkoa', 'Huelva', 'Huesca', 'Illes Balears', 'Jaén',
  'La Rioja', 'Las Palmas', 'León', 'Lleida', 'Lugo', 'Madrid', 'Málaga', 'Murcia',
  'Navarra', 'Ourense', 'Palencia', 'Pontevedra', 'Salamanca',
  'Santa Cruz de Tenerife', 'Segovia', 'Sevilla', 'Soria', 'Tarragona', 'Teruel',
  'Toledo', 'Valencia', 'Valladolid', 'Zamora', 'Zaragoza'
]);

export const DEFAULT_CITIES = Object.freeze([
  'A Coruña', 'Albacete', 'Alicante', 'Almería', 'Ávila', 'Badajoz', 'Barcelona',
  'Bilbao', 'Burgos', 'Cáceres', 'Cádiz', 'Castellón de la Plana', 'Ciudad Real',
  'Córdoba', 'Cuenca', 'Girona', 'Granada', 'Guadalajara', 'Huelva', 'Huesca',
  'Jaén', 'Las Palmas de Gran Canaria', 'León', 'Lleida', 'Logroño', 'Lugo',
  'Madrid', 'Málaga', 'Murcia', 'Oviedo', 'Ourense', 'Palencia', 'Palma', 'Pamplona',
  'Pontevedra', 'Salamanca', 'San Sebastián', 'Santa Cruz de Tenerife', 'Santander', 'Segovia',
  'Sevilla', 'Soria', 'Tarragona', 'Teruel', 'Toledo', 'Valencia', 'Valladolid',
  'Vitoria-Gasteiz', 'Zamora', 'Zaragoza'
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
  catalogDefaultsVersion: 0,
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
