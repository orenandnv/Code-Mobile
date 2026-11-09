/**
 * Persistência chave-valor do app.
 *
 * IndexedDB é a fonte principal (aguenta projetos grandes e snapshots de
 * recuperação); localStorage serve de reserva quando o IndexedDB não está
 * disponível (modo privado, WebView restrito).
 */

const DB_NAME = 'code-mobile';
const DB_VERSION = 1;
const STORE = 'kv';
const LS_PREFIX = 'code-mobile:';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDB(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch {
    /* armazenamento cheio: o app segue em memória */
  }
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const db = await openDB();
  if (!db) return lsGet<T>(key);
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get(key);
      request.onsuccess = () => resolve((request.result as T | undefined) ?? lsGet<T>(key));
      request.onerror = () => resolve(lsGet<T>(key));
    } catch {
      resolve(lsGet<T>(key));
    }
  });
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  if (!db) {
    lsSet(key, value);
    return;
  }
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        lsSet(key, value);
        resolve();
      };
      tx.onabort = () => resolve();
    } catch {
      lsSet(key, value);
      resolve();
    }
  });
}

export async function kvDel(key: string): Promise<void> {
  const db = await openDB();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch {
        resolve();
      }
    });
  }
  try {
    localStorage.removeItem(LS_PREFIX + key);
  } catch {
    /* ignore */
  }
}

/** Leitura síncrona apenas para preferências pequenas (tema, idioma). */
export function prefGet<T>(key: string, fallback: T): T {
  const value = lsGet<T>(key);
  return value === null ? fallback : value;
}

export function prefSet(key: string, value: unknown): void {
  lsSet(key, value);
}
