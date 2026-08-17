export type PieceColor = "w" | "b";

export type MoveClassification =
  | "brilliant"
  | "great"
  | "best"
  | "excellent"
  | "good"
  | "book"
  | "inaccuracy"
  | "mistake"
  | "blunder"
  | "miss";

export interface EngineMove {
  uci: string;
  san: string;
  score: number;
  mate?: number;
  depth: number;
  pv: string[];
}

export interface EngineResult {
  engineId: string;
  engineName: string;
  depth: number;
  bestMoves: EngineMove[];
  eval: number;
  mate?: number;
  ponder?: string;
}

export interface MultiEngineAnalysis {
  fen: string;
  engines: EngineResult[];
  consensusMove: string | null;
  consensusSan: string | null;
  agreement: number;
  evalRange: { min: number; max: number };
  /** Scores are already normalized to white POV — do not re-normalize. */
  whitePov?: boolean;
}

export interface MoveAnalysis {
  ply: number;
  san: string;
  uci: string;
  fen: string;
  playedEval: number;
  bestEval: number;
  evalLoss: number;
  classification: MoveClassification;
  bestMove: string;
  bestMoveSan: string;
  commentary: string;
  engineConsensus: MultiEngineAnalysis;
}

export interface GameMove {
  san: string;
  uci: string;
  fen: string;
  ply: number;
  color: PieceColor;
  captured?: string;
  isCheck: boolean;
  isCastle: boolean;
  isPromotion: boolean;
}

export interface ChessComGame {
  uuid: string;
  url: string;
  pgn: string;
  timeControl: string;
  endTime: number;
  rated: boolean;
  white: { username: string; rating: number; result: string };
  black: { username: string; rating: number; result: string };
}

export interface ImportedGame {
  id: string;
  pgn: string;
  headers: Record<string, string>;
  moves: GameMove[];
  startingFen: string;
}

export interface CoachEngineAlignment {
  agreement: "aligned" | "partial" | "divergent";
  engineLine: string;
  coachLine?: string;
  evalLabel: string;
  reasons: string[];
  mergedSummary: string;
}

export interface PositionCommentary {
  summary: string;
  tacticalThemes: string[];
  bestLineExplanation: string;
  pathToPosition: string;
  engineNotes: string[];
  alignment?: CoachEngineAlignment;
  source?: "rules" | "llm" | "merged";
}

export interface ReviewTimingStats {
  totalMs: number;
  positionsAnalyzed: number;
  positionsFailed: number;
  avgMsPerPosition: number;
}

export interface CoachAlignmentStats {
  compared: number;
  aligned: number;
  partial: number;
  divergent: number;
}

export interface AnalysisState {
  status: "idle" | "loading" | "analyzing" | "complete" | "error";
  progress: number;
  currentPly: number;
  moveAnalyses: MoveAnalysis[];
  positionCommentary: PositionCommentary | null;
  error?: string;
}
