import type { ImportedGame, MoveClassification, MultiEngineAnalysis, PieceColor } from "@/types";

/** The 4 buckets of classifyMove that represent a "real" puzzle; best/excellent are filtered out as trivial. */
export type PuzzleSeverity = Extract<MoveClassification, "good" | "inaccuracy" | "mistake" | "blunder">;

export interface BookSource {
  id: string;
  title: string;
  author: string;
  fileName: string;
  importedAt: string;
}

export interface SkippedToken {
  token: string;
  index: number;
  reason: string;
}

export interface ExtractedGameCandidate {
  id: string;
  sourcePages: number[];
  headerGuess?: string;
  rawTokens: string[];
  skippedTokens: SkippedToken[];
  game: ImportedGame | null;
  startingFen: string;
}

export interface PdfExtractionResult {
  fileName: string;
  pageCount: number;
  pageTexts: string[];
  candidates: ExtractedGameCandidate[];
}

export interface PuzzleCandidateMetrics {
  ply: number;
  fen: string;
  playedSan: string;
  playedUci: string;
  solutionEvalLoss: number;
  gapPawns: number;
  severity: PuzzleSeverity;
  bestMoveUci: string;
  bestMoveSan: string;
  secondMoveUci: string;
  secondMoveSan: string;
  analysis: MultiEngineAnalysis;
}

export interface Puzzle {
  id: string;
  bookSourceId: string;
  gameLabel: string;
  fen: string;
  sideToMove: PieceColor;
  solutionSan: string;
  solutionUci: string;
  severity: PuzzleSeverity;
  gapPawns: number;
  solutionEvalLoss: number;
  bestLineSan: string[];
  hint?: string;
  explanation?: string;
  ply: number;
  createdAt: string;
  solved?: { attempts: number; solvedAt: string } | null;
}

export interface PuzzleScanProgress {
  done: number;
  total: number;
  puzzlesFound: number;
  currentPly: number;
}

export interface PuzzleScanResult {
  puzzles: Puzzle[];
  scanned: number;
  failed: number;
}
