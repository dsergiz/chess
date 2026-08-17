import type { BookMove } from "@/lib/openingExplorer";

const DB_NAME = "chess-eval-opening-book";
const DB_VERSION = 1;
const STORE_NAME = "moves";

/** Opening theory doesn't go stale — cap entry count, not age, so the store can't grow unbounded. */
const MAX_ENTRIES = 500;

interface BookCacheRecord {
  fen: string;
  updatedAt: number;
  moves: BookMove[];
}

function isSupported(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "fen" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadCachedBookMoves(fen: string): Promise<BookMove[] | null> {
  if (!isSupported()) return null;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const record = await requestToPromise<BookCacheRecord | undefined>(
      tx.objectStore(STORE_NAME).get(fen)
    );
    db.close();
    return record?.moves ?? null;
  } catch {
    return null;
  }
}

export async function saveCachedBookMoves(fen: string, moves: BookMove[]): Promise<void> {
  if (!isSupported()) return;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({ fen, updatedAt: Date.now(), moves } satisfies BookCacheRecord);

    const all = await requestToPromise<BookCacheRecord[]>(store.getAll());
    if (all.length > MAX_ENTRIES) {
      all
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(MAX_ENTRIES)
        .forEach((r) => store.delete(r.fen));
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Best-effort cache — opening lookups still work without persistence.
  }
}
