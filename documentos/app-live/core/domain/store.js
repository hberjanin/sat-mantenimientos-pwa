/**
 * Persistencia local de la aplicación.
 *
 * IndexedDB conserva la copia durable y permite guardar blobs grandes (firmas,
 * fotos y PDF). localStorage se mantiene como caché síncrona y como formato de
 * compatibilidad para que los módulos actuales puedan leer datos al arrancar.
 * La migración es automática y nunca borra la clave antigua.
 */

import { EMPTY_DATA, STORAGE_CORRUPT_BACKUP_SUFFIX, STORAGE_KEY } from './constants.js?v=1.0.49';
import { normalizeData, parseStoredData } from './schema.js?v=1.0.49';

const DATABASE_NAME = 'sat-mantenimientos-v2';
const DATABASE_VERSION = 1;
const STATE_STORE = 'state';
const REPORT_STORE = 'reports';
const STATE_RECORD_KEY = 'current';
const META_SUFFIX = '-persistence-meta-v1';

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Error de IndexedDB'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Error de transacción'));
    transaction.onabort = () => reject(transaction.error || new Error('Transacción cancelada'));
  });
}

function openDatabase() {
  if (!globalThis.indexedDB?.open) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STATE_STORE)) database.createObjectStore(STATE_STORE, { keyPath: 'key' });
      if (!database.objectStoreNames.contains(REPORT_STORE)) database.createObjectStore(REPORT_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No se pudo abrir IndexedDB'));
    request.onblocked = () => reject(new Error('IndexedDB está bloqueada por otra pestaña'));
  });
}

export function createStore(storage = globalThis.localStorage, key = STORAGE_KEY) {
  const metaKey = `${key}${META_SUFFIX}`;
  let lastError = null;
  let backedUpCorruptValue = null;
  let durableDatabase = null;
  let durableQueue = Promise.resolve();
  let hydrated = false;
  let persistentStorage = false;
  let usage = null;
  let quota = null;

  const status = () => ({
    backend: durableDatabase ? 'IndexedDB + localStorage' : 'localStorage',
    indexedDbAvailable: Boolean(globalThis.indexedDB?.open),
    durableReady: Boolean(durableDatabase),
    hydrated,
    persistentStorage,
    usage,
    quota,
    error: lastError?.message || ''
  });

  const readRaw = () => {
    try {
      return storage?.getItem(key) || JSON.stringify(EMPTY_DATA);
    } catch (error) {
      lastError = error;
      return JSON.stringify(EMPTY_DATA);
    }
  };

  const readMeta = () => {
    try {
      const value = JSON.parse(storage?.getItem(metaKey) || '{}');
      return {
        revision: Number.isInteger(value.revision) && value.revision >= 0 ? value.revision : 0,
        updatedAt: String(value.updatedAt || '')
      };
    } catch {
      return { revision: 0, updatedAt: '' };
    }
  };

  const preserveCorruptValue = (error, raw) => {
    lastError = error;
    if (!raw || raw === backedUpCorruptValue) return;
    backedUpCorruptValue = raw;
    try {
      storage?.setItem(`${key}${STORAGE_CORRUPT_BACKUP_SUFFIX}`, JSON.stringify({
        detectedAt: new Date().toISOString(),
        reason: String(error?.message || error),
        raw: raw.slice(0, 1024 * 1024)
      }));
    } catch {
      // La recuperación no debe impedir que la aplicación arranque.
    }
  };

  const parseLocalSnapshot = () => {
    const raw = storage?.getItem?.(key) || '';
    if (!raw) return { data: normalizeData({}), revision: 0, updatedAt: '' };
    const metadata = readMeta();
    return {
      data: parseStoredData(raw, preserveCorruptValue),
      revision: Math.max(1, metadata.revision),
      updatedAt: metadata.updatedAt
    };
  };

  const writeLocalSnapshot = (data, revision, updatedAt) => {
    storage.setItem(key, JSON.stringify(data));
    storage.setItem(metaKey, JSON.stringify({ revision, updatedAt }));
  };

  const readDurableState = async () => {
    if (!durableDatabase) return null;
    const transaction = durableDatabase.transaction(STATE_STORE, 'readonly');
    return requestResult(transaction.objectStore(STATE_STORE).get(STATE_RECORD_KEY));
  };

  const queueDurableState = (data, revision, updatedAt) => {
    if (!durableDatabase) return durableQueue;
    const record = { key: STATE_RECORD_KEY, revision, updatedAt, data: JSON.parse(JSON.stringify(data)) };
    durableQueue = durableQueue.then(async () => {
      const transaction = durableDatabase.transaction(STATE_STORE, 'readwrite');
      transaction.objectStore(STATE_STORE).put(record);
      await transactionDone(transaction);
    }).catch((error) => {
      lastError = error;
      globalThis.dispatchEvent?.(new CustomEvent('sat-storage-error', { detail: { error } }));
    });
    return durableQueue;
  };

  const refreshStorageEstimate = async () => {
    try {
      const estimate = await globalThis.navigator?.storage?.estimate?.();
      usage = Number.isFinite(estimate?.usage) ? estimate.usage : null;
      quota = Number.isFinite(estimate?.quota) ? estimate.quota : null;
    } catch {
      usage = null;
      quota = null;
    }
  };

  const requestPersistentStorage = async () => {
    try {
      if (globalThis.navigator?.storage?.persist) persistentStorage = await globalThis.navigator.storage.persist();
    } catch {
      persistentStorage = false;
    }
    await refreshStorageEstimate();
  };

  const hydrate = async () => {
    if (!globalThis.indexedDB?.open) {
      hydrated = true;
      return;
    }
    try {
      durableDatabase = await openDatabase();
      await requestPersistentStorage();
      const local = parseLocalSnapshot();
      const durable = await readDurableState();
      if (durable?.data && Number(durable.revision) > local.revision) {
        const restored = normalizeData(durable.data);
        writeLocalSnapshot(restored, Number(durable.revision), String(durable.updatedAt || new Date().toISOString()));
      } else if (local.revision > 0) {
        await queueDurableState(local.data, local.revision, local.updatedAt || new Date().toISOString());
      }
      hydrated = true;
    } catch (error) {
      lastError = error;
      durableDatabase = null;
      hydrated = true;
      globalThis.dispatchEvent?.(new CustomEvent('sat-storage-error', { detail: { error } }));
    }
  };

  const readyPromise = hydrate();

  const read = () => parseStoredData(readRaw(), preserveCorruptValue);

  const write = (value) => {
    const normalized = normalizeData(value);
    const serialized = JSON.stringify(normalized);
    const previousMeta = readMeta();
    const revision = previousMeta.revision + 1;
    const updatedAt = new Date().toISOString();
    try {
      if (!storage?.setItem) throw new Error('El almacenamiento local no está disponible');
      storage.setItem(key, serialized);
      storage.setItem(metaKey, JSON.stringify({ revision, updatedAt }));
      lastError = null;
      queueDurableState(normalized, revision, updatedAt);
      return normalized;
    } catch (error) {
      lastError = error;
      throw new Error('No se pudieron guardar los cambios. Exporta una copia y libera espacio del navegador.', { cause: error });
    }
  };

  const update = (mutator) => {
    if (typeof mutator !== 'function') throw new TypeError('La actualización del almacenamiento debe ser una función');
    // localStorage no ofrece transacciones. Si otra pestaña escribe entre la lectura y
    // la escritura, repetimos la mutación sobre el estado más reciente para no pisarlo.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const before = readRaw();
      const current = parseStoredData(before, preserveCorruptValue);
      const next = mutator(current) || current;
      if (readRaw() !== before) continue;
      return write(next);
    }
    throw new Error('No se pudieron combinar los cambios porque otra pestaña está actualizando los datos. Vuelve a intentarlo.');
  };

  const saveReportSnapshot = async (snapshot) => {
    await readyPromise;
    if (!durableDatabase) throw new Error('No hay almacenamiento durable disponible para archivar el informe');
    if (!snapshot?.id || !(snapshot.pdf instanceof Blob)) throw new TypeError('El informe no contiene un PDF válido');
    const record = { ...snapshot, savedAt: new Date().toISOString() };
    const transaction = durableDatabase.transaction(REPORT_STORE, 'readwrite');
    transaction.objectStore(REPORT_STORE).put(record);
    await transactionDone(transaction);
    await refreshStorageEstimate();
  };

  const getReportSnapshot = async (id) => {
    await readyPromise;
    if (!durableDatabase) return null;
    const transaction = durableDatabase.transaction(REPORT_STORE, 'readonly');
    return requestResult(transaction.objectStore(REPORT_STORE).get(id));
  };

  const listReportSnapshots = async () => {
    await readyPromise;
    if (!durableDatabase) return [];
    const transaction = durableDatabase.transaction(REPORT_STORE, 'readonly');
    return requestResult(transaction.objectStore(REPORT_STORE).getAll());
  };

  return Object.freeze({
    key,
    read,
    write,
    update,
    ready: () => readyPromise,
    getStatus: status,
    saveReportSnapshot,
    getReportSnapshot,
    listReportSnapshots,
    getLastError: () => lastError
  });
}
