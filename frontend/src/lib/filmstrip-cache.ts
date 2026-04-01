/**
 * IndexedDB cache for filmstrip thumbnail frames (JPEG data URLs).
 * Keys are scoped by lecture + video URL + duration so invalidation is automatic.
 */

const DB_NAME = "accesslecture-filmstrip";
const DB_VERSION = 1;
const STORE = "frames";
const MAX_KEYS = 40;

export interface FilmstripFrame {
  timeMs: number;
  dataUrl: string;
}

interface StoredEntry {
  key: string;
  frames: FilmstripFrame[];
  savedAt: number;
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

export function filmstripCacheKey(
  lectureId: string,
  videoUrl: string,
  durationMs: number
): string {
  return `${lectureId}:${simpleHash(videoUrl)}:${durationMs}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
  });
}

export async function getFilmstripFromCache(
  cacheKey: string
): Promise<FilmstripFrame[] | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const g = store.get(cacheKey);
      g.onerror = () => reject(g.error);
      g.onsuccess = () => {
        const row = g.result as StoredEntry | undefined;
        db.close();
        resolve(row?.frames?.length ? row.frames : null);
      };
    });
  } catch {
    return null;
  }
}

export async function saveFilmstripToCache(
  cacheKey: string,
  frames: FilmstripFrame[]
): Promise<void> {
  if (typeof indexedDB === "undefined" || frames.length === 0) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const put = store.put({
        key: cacheKey,
        frames,
        savedAt: Date.now(),
      } as StoredEntry);
      put.onerror = () => reject(put.error);
      put.onsuccess = () => resolve();
      tx.oncomplete = () => db.close();
    });
    await trimFilmstripCache();
  } catch {
    /* ignore quota errors */
  }
}

async function trimFilmstripCache(): Promise<void> {
  try {
    const db = await openDb();
    const keys: { key: string; savedAt: number }[] = await new Promise(
      (resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const store = tx.objectStore(STORE);
        const req = store.getAll();
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const rows = (req.result as StoredEntry[]) ?? [];
          resolve(rows.map((r) => ({ key: r.key, savedAt: r.savedAt })));
        };
      }
    );
    db.close();

    if (keys.length <= MAX_KEYS) return;

    keys.sort((a, b) => a.savedAt - b.savedAt);
    const toDelete = keys.slice(0, keys.length - MAX_KEYS);
    const db2 = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db2.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      for (const k of toDelete) store.delete(k.key);
      tx.oncomplete = () => {
        db2.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}
