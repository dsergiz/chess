import type { EngineResult, MultiEngineAnalysis } from "@/types";
import { uciToSan } from "../chess";
import { buildConsensus } from "./multiEngine";
import { sanitizeAnalysis } from "./normalizeAnalysis";
import {
  type AnalysisMode,
  ANALYSIS_MODE_PASSES,
  cacheKeyForAnalysis,
  type AnalysisPassConfig,
} from "./analysisModes";

export type AnalysisScope = "live" | "batch";

interface ParsedInfoLine {
  depth: number;
  eval: number;
  mate?: number;
  pvMoves: string[];
  multipv: number;
}

const analysisCache = new Map<string, MultiEngineAnalysis>();

let worker: Worker | null = null;
let initPromise: Promise<void> | null = null;
let liveRunId = 0;
let batchRunId = 0;
let idlePromise: Promise<void> = Promise.resolve();
let configuredMultiPv = 0;

function runIdForScope(scope: AnalysisScope): number {
  return scope === "batch" ? batchRunId : liveRunId;
}

function waitForWorkerIdle(): Promise<void> {
  return idlePromise;
}

function markWorkerBusy(): void {
  idlePromise = new Promise((resolve) => {
    idleResolve = resolve;
  });
}

let idleResolve: (() => void) | null = null;

function markWorkerIdle(): void {
  if (idleResolve) {
    idleResolve();
    idleResolve = null;
  }
  idlePromise = Promise.resolve();
}

function parseInfoLine(line: string): ParsedInfoLine | null {
  if (!line.startsWith("info ") || !line.includes(" score ")) return null;

  const depthMatch = line.match(/depth (\d+)/);
  const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
  const pvMatch = line.match(/ pv (.+)$/);
  const multipvMatch = line.match(/multipv (\d+)/);

  if (!depthMatch || !scoreMatch) return null;

  const depth = parseInt(depthMatch[1], 10);
  const isMate = scoreMatch[1] === "mate";
  const rawScore = parseInt(scoreMatch[2], 10);
  const evalScore = isMate ? (rawScore > 0 ? 10000 : -10000) : rawScore;
  const mate = isMate ? rawScore : undefined;

  return {
    depth,
    eval: evalScore,
    mate,
    pvMoves: pvMatch?.[1]?.split(" ") ?? [],
    multipv: multipvMatch ? parseInt(multipvMatch[1], 10) : 1,
  };
}

function postAndWait(message: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!worker) {
      reject(new Error("Worker not initialized"));
      return;
    }

    const timeout = setTimeout(() => {
      worker?.removeEventListener("message", onMessage);
      reject(new Error("Stockfish command timeout"));
    }, 15000);

    const onMessage = (e: MessageEvent<string>) => {
      if (e.data === "readyok") {
        clearTimeout(timeout);
        worker?.removeEventListener("message", onMessage);
        resolve();
      }
    };

    worker.addEventListener("message", onMessage);
    worker.postMessage(message);
  });
}

function ensureWorker(): Promise<void> {
  if (typeof Worker === "undefined") {
    return Promise.reject(new Error("Web Workers not available"));
  }
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve, reject) => {
    worker = new Worker("/stockfish-worker.js");
    const timeout = setTimeout(() => reject(new Error("Stockfish init timeout")), 12000);

    const onMessage = (e: MessageEvent<string>) => {
      const line = e.data as string;
      if (line === "uciok") {
        worker?.postMessage("isready");
      } else if (line === "readyok") {
        clearTimeout(timeout);
        worker?.removeEventListener("message", onMessage);
        resolve();
      }
    };

    worker.addEventListener("message", onMessage);
    worker.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("Stockfish worker failed to load"));
    };
    worker.postMessage("uci");
  });

  return initPromise;
}

function runAnalysisPass(
  fen: string,
  pass: AnalysisPassConfig,
  scope: AnalysisScope,
  startedRunId: number,
  options?: { freshGame?: boolean }
): Promise<EngineResult> {
  return new Promise(async (resolve, reject) => {
    if (!worker) {
      reject(new Error("Worker not initialized"));
      return;
    }

    const lines = new Map<number, { score: number; mate?: number; depth: number; pv: string[]; uci: string }>();
    let bestDepth = 0;
    let timeout: ReturnType<typeof setTimeout>;

    try {
      if (configuredMultiPv !== pass.multiPv) {
        worker.postMessage(`setoption name MultiPV value ${pass.multiPv}`);
        configuredMultiPv = pass.multiPv;
        await postAndWait("isready");
      }
    } catch (err) {
      reject(err);
      markWorkerIdle();
      return;
    }

    if (startedRunId !== runIdForScope(scope)) {
      markWorkerIdle();
      reject(new Error("Analysis cancelled"));
      return;
    }

    const onMessage = (e: MessageEvent<string>) => {
      const line = e.data as string;

      if (line.startsWith("bestmove")) {
        clearTimeout(timeout);
        worker?.removeEventListener("message", onMessage);
        markWorkerIdle();

        if (startedRunId !== runIdForScope(scope)) {
          reject(new Error("Analysis cancelled"));
          return;
        }

        const ranked = Array.from(lines.values()).sort((a, b) => b.score - a.score);
        const bestMoves = ranked.slice(0, pass.multiPv).map((entry) => ({
          uci: entry.uci,
          san: uciToSan(fen, entry.uci),
          score: entry.score,
          mate: entry.mate,
          depth: entry.depth,
          pv: entry.pv,
        }));

        const primary = bestMoves[0];
        resolve({
          engineId: pass.id,
          engineName: pass.name,
          depth: bestDepth || 12,
          bestMoves,
          eval: primary?.score ?? 0,
          mate: primary?.mate,
          ponder: primary?.uci,
        });
        return;
      }

      const info = parseInfoLine(line);
      if (!info || info.pvMoves.length === 0) return;

      bestDepth = Math.max(bestDepth, info.depth);
      lines.set(info.multipv, {
        uci: info.pvMoves[0],
        score: info.eval,
        mate: info.mate,
        depth: info.depth,
        pv: info.pvMoves,
      });
    };

    worker.addEventListener("message", onMessage);
    timeout = setTimeout(() => {
      worker?.removeEventListener("message", onMessage);
      markWorkerIdle();
      reject(new Error(`${pass.name} timed out`));
    }, pass.movetime + 5000);

    markWorkerBusy();
    if (options?.freshGame !== false) {
      worker.postMessage("ucinewgame");
    }
    worker.postMessage(`position fen ${fen}`);
    const depthClause = pass.minDepth ? ` depth ${pass.minDepth}` : "";
    worker.postMessage(`go movetime ${pass.movetime}${depthClause}`);
  });
}

export function cancelLiveAnalysis(): void {
  liveRunId++;
  if (worker) {
    worker.postMessage("stop");
  }
  markWorkerIdle();
}

export function cancelBatchAnalysis(): void {
  batchRunId++;
  if (worker) {
    worker.postMessage("stop");
  }
  markWorkerIdle();
}

/** @deprecated use cancelLiveAnalysis */
export function cancelActiveAnalysis(): void {
  cancelLiveAnalysis();
}

export function destroyStockfishWorker(): void {
  liveRunId++;
  batchRunId++;
  if (worker) {
    worker.terminate();
    worker = null;
    initPromise = null;
    configuredMultiPv = 0;
  }
  markWorkerIdle();
}

export function getCachedAnalysis(
  fen: string,
  mode: AnalysisMode = "fast"
): MultiEngineAnalysis | undefined {
  return analysisCache.get(cacheKeyForAnalysis(fen, mode));
}

export interface AnalyzeOptions {
  force?: boolean;
  mode?: AnalysisMode;
  freshGame?: boolean;
  scope?: AnalysisScope;
}

export async function analyzeWithStockfishPool(
  fen: string,
  onProgress?: (pass: number, total: number) => void,
  options?: AnalyzeOptions
): Promise<MultiEngineAnalysis> {
  const mode = options?.mode ?? "fast";
  const scope = options?.scope ?? "live";
  const cacheKey = cacheKeyForAnalysis(fen, mode);
  const startedRunId = runIdForScope(scope);

  if (!options?.force) {
    const cached = analysisCache.get(cacheKey);
    if (cached) return cached;
  } else {
    analysisCache.delete(cacheKey);
  }

  await ensureWorker();
  await waitForWorkerIdle();

  const passes = ANALYSIS_MODE_PASSES[mode];
  const engines: EngineResult[] = [];

  for (let i = 0; i < passes.length; i++) {
    if (startedRunId !== runIdForScope(scope)) throw new Error("Analysis cancelled");
    onProgress?.(i + 1, passes.length);
    engines.push(
      await runAnalysisPass(fen, passes[i], scope, startedRunId, {
        freshGame: options?.freshGame ?? i === 0,
      })
    );
  }

  if (startedRunId !== runIdForScope(scope)) throw new Error("Analysis cancelled");

  const consensus = sanitizeAnalysis(fen, buildConsensus(fen, engines));
  analysisCache.set(cacheKey, consensus);
  return consensus;
}

export function clearAnalysisCache(): void {
  analysisCache.clear();
}

export { ANALYSIS_MODE_PASSES, ANALYSIS_MODE_LABELS, type AnalysisMode } from "./analysisModes";
