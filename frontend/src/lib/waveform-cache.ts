/**
 * IndexedDB cache for WaveSurfer precomputed peaks so revisiting a lecture
 * skips re-decoding the full audio for the waveform.
 */

const DB_NAME = "accesslecture-waveform";
const DB_VERSION = 1;
const STORE = "peaks";
const MAX_KEYS = 40;

export interface CachedWaveform {
  peaks: number[][];
  duration: number;
}

interface StoredEntry {
  key: string;
  peaks: number[][];
  duration: number;
  savedAt: number;
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

export function waveformCacheKey(lectureId: string, audioUrl: string): string {
  return `${lectureId}:${simpleHash(audioUrl)}`;
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

export async function getWaveformFromCache(
  cacheKey: string
): Promise<CachedWaveform | null> {
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
        if (
          !row?.peaks?.length ||
          typeof row.duration !== "number" ||
          row.duration <= 0
        ) {
          resolve(null);
          return;
        }
        resolve({ peaks: row.peaks, duration: row.duration });
      };
    });
  } catch {
    return null;
  }
}

export async function saveWaveformToCache(
  cacheKey: string,
  peaks: number[][],
  duration: number
): Promise<void> {
  if (typeof indexedDB === "undefined" || !peaks.length || duration <= 0) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const put = store.put({
        key: cacheKey,
        peaks,
        duration,
        savedAt: Date.now(),
      } as StoredEntry);
      put.onerror = () => reject(put.error);
      put.onsuccess = () => resolve();
      tx.oncomplete = () => db.close();
    });
    await trimWaveformCache();
  } catch {
    /* ignore quota errors */
  }
}

async function trimWaveformCache(): Promise<void> {
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

/** Remove cached waveform for a lecture (e.g. after delete). */
export async function deleteWaveformCacheForLecture(lectureId: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const prefix = `${lectureId}:`;
  try {
    const db = await openDb();
    const allKeys: string[] = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const req = store.getAll();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const rows = (req.result as StoredEntry[]) ?? [];
        resolve(rows.map((r) => r.key));
      };
    });
    db.close();

    const toRemove = allKeys.filter((k) => k.startsWith(prefix));
    if (!toRemove.length) return;

    const db2 = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db2.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      for (const k of toRemove) store.delete(k);
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
