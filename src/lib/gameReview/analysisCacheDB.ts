import type { MultiEngineAnalysis } from "@/types";
import type { AnalysisMode } from "@/lib/engines/analysisModes";
import { DEMO_GAME_ID } from "@/lib/demoGame";

const DB_NAME = "chess-eval-cache";
const DB_VERSION = 1;
const STORE_NAME = "gameAnalysis";

/** How many non-demo games keep their analysis cached across page reloads. */
const MAX_RECENT_GAMES = 3;

export interface CachedAnalysisEntry {
  fen: string;
  mode: AnalysisMode;
  analysis: MultiEngineAnalysis;
}

interface GameAnalysisRecord {
  gameId: string;
  updatedAt: number;
  entries: CachedAnalysisEntry[];
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
        db.createObjectStore(STORE_NAME, { keyPath: "gameId" });
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

export async function loadCachedGameAnalysis(gameId: string): Promise<CachedAnalysisEntry[] | null> {
  if (!isSupported()) return null;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const record = await requestToPromise<GameAnalysisRecord | undefined>(
      tx.objectStore(STORE_NAME).get(gameId)
    );
    db.close();
    return record?.entries ?? null;
  } catch {
    return null;
  }
}

export async function saveCachedGameAnalysis(
  gameId: string,
  entries: CachedAnalysisEntry[]
): Promise<void> {
  if (!isSupported() || entries.length === 0) return;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({ gameId, updatedAt: Date.now(), entries } satisfies GameAnalysisRecord);

    const all = await requestToPromise<GameAnalysisRecord[]>(store.getAll());
    const evictable = all
      .filter((r) => r.gameId !== DEMO_GAME_ID && r.gameId !== gameId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    evictable.slice(MAX_RECENT_GAMES - 1).forEach((r) => store.delete(r.gameId));

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Best-effort cache — analysis still works without persistence.
  }
}
