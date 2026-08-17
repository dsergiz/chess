import type { ImportedGame, MultiEngineAnalysis } from "@/types";
import { analyzeWithMultipleEngines, cancelBatchAnalysis, getCachedAnalysis } from "@/lib/engines/multiEngine";
import { buildBatchReviewStats, type BatchReviewStats } from "@/lib/gameReview/reviewTiming";

export interface BatchReviewProgress {
  percent: number;
  done: number;
  total: number;
  gameTitle: string;
}

export interface BatchAnalyzeResult {
  cache: Map<number, MultiEngineAnalysis>;
  stats: BatchReviewStats;
}

/** Analyze every position with Stockfish before the game is shown. */
export async function batchAnalyzeGame(
  game: ImportedGame,
  onProgress: (done: number, total: number, elapsedMs: number) => void,
  isCancelled: () => boolean
): Promise<BatchAnalyzeResult> {
  const total = game.moves.length + 1;
  const results = new Map<number, MultiEngineAnalysis>();
  const started = performance.now();
  let failed = 0;

  const positions: { ply: number; fen: string }[] = [
    { ply: 0, fen: game.startingFen },
    ...game.moves.map((m) => ({ ply: m.ply, fen: m.fen })),
  ];

  let firstInRun = true;

  for (let i = 0; i < positions.length; i++) {
    if (isCancelled()) break;
    const { ply, fen } = positions[i];

    const cached = getCachedAnalysis(fen, "review");
    if (cached) {
      results.set(ply, cached);
      onProgress(i + 1, total, performance.now() - started);
      continue;
    }

    try {
      const analysis = await analyzeWithMultipleEngines(fen, undefined, {
        mode: "review",
        force: false,
        freshGame: firstInRun,
        scope: "batch",
      });
      firstInRun = false;
      results.set(ply, analysis);
    } catch {
      failed++;
      firstInRun = true;
    }
    onProgress(i + 1, total, performance.now() - started);
  }

  const totalMs = performance.now() - started;
  return {
    cache: results,
    stats: buildBatchReviewStats(totalMs, results.size, failed),
  };
}

export function cancelBatchReview(): void {
  cancelBatchAnalysis();
}
