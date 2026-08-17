export type AnalysisMode = "fast" | "deep" | "tactical" | "compare" | "review";

export interface AnalysisPassConfig {
  id: string;
  name: string;
  movetime: number;
  multiPv: number;
  minDepth?: number;
}

export const ANALYSIS_MODE_LABELS: Record<AnalysisMode, string> = {
  fast: "Fast (~0.5s)",
  deep: "Deep (~2s)",
  tactical: "Tactical lines",
  compare: "Multi-pass compare",
  review: "Game review",
};

export const ANALYSIS_MODE_PASSES: Record<AnalysisMode, AnalysisPassConfig[]> = {
  fast: [{ id: "sf-fast", name: "Stockfish Fast", movetime: 650, multiPv: 1, minDepth: 14 }],
  deep: [{ id: "sf-deep", name: "Stockfish Deep", movetime: 3500, multiPv: 3, minDepth: 22 }],
  tactical: [{ id: "sf-tactical", name: "Stockfish Tactical", movetime: 1600, multiPv: 4, minDepth: 18 }],
  compare: [
    { id: "sf-quick", name: "Stockfish (Quick)", movetime: 500, multiPv: 1, minDepth: 12 },
    { id: "sf-standard", name: "Stockfish (Standard)", movetime: 1200, multiPv: 2, minDepth: 16 },
    { id: "sf-verify", name: "Stockfish (Verify)", movetime: 1800, multiPv: 1, minDepth: 20 },
  ],
  // multiPv: 2 (not 1) so the gap between the best and 2nd-best move is available during normal
  // game review — used to detect "great" finds and "miss"ed clearly-better moves, not just eval loss.
  review: [{ id: "sf-review", name: "Stockfish Review", movetime: 1000, multiPv: 2, minDepth: 16 }],
};

export function cacheKeyForAnalysis(fen: string, mode: AnalysisMode): string {
  return `${mode}:${fen}`;
}
