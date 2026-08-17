export interface BatchReviewStats {
  totalMs: number;
  positionsAnalyzed: number;
  positionsFailed: number;
  avgMsPerPosition: number;
}

export function formatReviewDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${remainder}s`;
}

export function buildBatchReviewStats(
  totalMs: number,
  analyzed: number,
  failed: number
): BatchReviewStats {
  return {
    totalMs,
    positionsAnalyzed: analyzed,
    positionsFailed: failed,
    avgMsPerPosition: analyzed > 0 ? Math.round(totalMs / analyzed) : 0,
  };
}
