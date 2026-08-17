import type { EngineResult, MultiEngineAnalysis } from "@/types";
import { uciToSan } from "../chess";

export interface StockfishWorkerMessage {
  type: "ready" | "result" | "error";
  engineId: string;
  result?: EngineResult;
  error?: string;
}

const ENGINE_CONFIGS = [
  { id: "stockfish-fast", name: "Stockfish (Fast)", depth: 12, multiPv: 3 },
  { id: "stockfish-deep", name: "Stockfish (Deep)", depth: 18, multiPv: 3 },
  { id: "stockfish-tactical", name: "Stockfish (Tactical)", depth: 15, multiPv: 5 },
];

interface ParsedInfoLine {
  depth: number;
  eval: number;
  mate?: number;
  pvMoves: string[];
}

function parseInfoLine(line: string): ParsedInfoLine | null {
  if (!line.startsWith("info ") || !line.includes(" score ")) return null;

  const depthMatch = line.match(/depth (\d+)/);
  const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
  const pvMatch = line.match(/ pv (.+)$/);

  if (!depthMatch || !scoreMatch) return null;

  const depth = parseInt(depthMatch[1], 10);
  const isMate = scoreMatch[1] === "mate";
  const rawScore = parseInt(scoreMatch[2], 10);
  const evalScore = isMate ? (rawScore > 0 ? 10000 : -10000) : rawScore;
  const mate = isMate ? rawScore : undefined;
  const pvMoves = pvMatch?.[1]?.split(" ") ?? [];

  return { depth, eval: evalScore, mate, pvMoves };
}

export function analyzePositionInWorker(
  fen: string,
  config: (typeof ENGINE_CONFIGS)[number]
): Promise<EngineResult> {
  return new Promise((resolve, reject) => {
    if (typeof Worker === "undefined") {
      reject(new Error("Web Workers not available"));
      return;
    }

    const worker = new Worker("/stockfish-worker.js");
    let bestInfo: ParsedInfoLine | null = null;
    const allMoves = new Map<string, { score: number; mate?: number; depth: number; pv: string[] }>();
    let timeout: ReturnType<typeof setTimeout>;

    const cleanup = () => {
      clearTimeout(timeout);
      worker.terminate();
    };

    timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Engine ${config.name} timed out`));
    }, 30000);

    worker.onmessage = (e: MessageEvent<string>) => {
      const line = e.data as string;

      if (line === "uciok") {
        worker.postMessage(`setoption name MultiPV value ${config.multiPv}`);
        worker.postMessage("isready");
        return;
      }

      if (line === "readyok") {
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage(`go depth ${config.depth}`);
        return;
      }

      if (line.startsWith("bestmove")) {
        cleanup();

        const moves = Array.from(allMoves.entries())
          .sort((a, b) => b[1].score - a[1].score)
          .slice(0, config.multiPv)
          .map(([uci, data]) => ({
            uci,
            san: uciToSan(fen, uci),
            score: data.score,
            mate: data.mate,
            depth: data.depth,
            pv: data.pv,
          }));

        const primary = moves[0];
        resolve({
          engineId: config.id,
          engineName: config.name,
          depth: bestInfo?.depth ?? config.depth,
          bestMoves: moves,
          eval: primary?.score ?? 0,
          mate: primary?.mate,
          ponder: primary?.uci,
        });
        return;
      }

      const info = parseInfoLine(line);
      if (!info) return;

      if (!bestInfo || info.depth >= bestInfo.depth) {
        bestInfo = info;
      }

      const pvMoves = info.pvMoves;
      if (pvMoves.length > 0) {
        const uci = pvMoves[0];
        allMoves.set(uci, {
          score: info.eval,
          mate: info.mate,
          depth: info.depth,
          pv: pvMoves,
        });
      }
    };

    worker.onerror = () => {
      cleanup();
      reject(new Error(`Engine ${config.name} worker error`));
    };

    worker.postMessage("uci");
  });
}

export async function analyzeWithMultipleEngines(
  fen: string,
  onProgress?: (pass: number, total: number) => void,
  options?: { force?: boolean; mode?: import("./analysisModes").AnalysisMode; freshGame?: boolean; scope?: import("./stockfishPool").AnalysisScope }
): Promise<MultiEngineAnalysis> {
  const { analyzeWithStockfishPool } = await import("./stockfishPool");
  return analyzeWithStockfishPool(fen, onProgress, options);
}

export {
  cancelLiveAnalysis,
  cancelBatchAnalysis,
  cancelActiveAnalysis,
  getCachedAnalysis,
  clearAnalysisCache,
} from "./stockfishPool";
export type { AnalysisMode } from "./analysisModes";
export { ANALYSIS_MODE_LABELS } from "./analysisModes";

export function buildConsensus(fen: string, engines: EngineResult[]): MultiEngineAnalysis {
  const moveVotes = new Map<string, number>();
  const moveSan = new Map<string, string>();

  engines.forEach((engine) => {
    const top = engine.bestMoves[0];
    if (top) {
      moveVotes.set(top.uci, (moveVotes.get(top.uci) ?? 0) + 1);
      moveSan.set(top.uci, top.san);
    }
  });

  let consensusMove: string | null = null;
  let maxVotes = 0;
  moveVotes.forEach((votes, uci) => {
    if (votes > maxVotes) {
      maxVotes = votes;
      consensusMove = uci;
    }
  });

  const evals = engines.map((e) => e.eval);
  const agreement = engines.length > 0 ? maxVotes / engines.length : 0;

  return {
    fen,
    engines,
    consensusMove,
    consensusSan: consensusMove ? moveSan.get(consensusMove) ?? null : null,
    agreement,
    evalRange: {
      min: Math.min(...evals),
      max: Math.max(...evals),
    },
  };
}

export { ENGINE_CONFIGS };
