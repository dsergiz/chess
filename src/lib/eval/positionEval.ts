import { Chess, evalToWhitePerspective, sideToMoveFromFen } from "@/lib/chess";
import type { PieceColor } from "@/types";

export interface WhitePovEval {
  eval: number;
  mate?: number;
  terminal?: "checkmate" | "stalemate" | "draw";
  terminalLabel?: string;
}

/** Authoritative eval for terminal positions (overrides engine noise). */
export function terminalPositionEval(fen: string): WhitePovEval | null {
  try {
    const chess = new Chess(fen);
    if (chess.isCheckmate()) {
      const stm = chess.turn() as PieceColor;
      const mate = stm === "w" ? -1 : 1;
      return {
        eval: 0,
        mate,
        terminal: "checkmate",
        terminalLabel: stm === "w" ? "Checkmate — Black wins" : "Checkmate — White wins",
      };
    }
    if (chess.isStalemate()) {
      return { eval: 0, terminal: "stalemate", terminalLabel: "Stalemate — drawn" };
    }
    if (chess.isDraw()) {
      return { eval: 0, terminal: "draw", terminalLabel: "Drawn position" };
    }
  } catch {
    return null;
  }
  return null;
}

export function mergeEngineEval(
  fen: string,
  engineEval: number,
  engineMate?: number
): WhitePovEval {
  const terminal = terminalPositionEval(fen);
  if (terminal) return terminal;

  const stm = sideToMoveFromFen(fen);
  const white = evalToWhitePerspective(engineEval, engineMate, stm);
  return { eval: white.eval, mate: white.mate };
}

export function describeAdvantage(evalCp: number, mate?: number): string {
  if (mate !== undefined) {
    if (mate > 0) return mate === 1 ? "White delivers mate" : `White is winning (mate in ${mate})`;
    if (mate < 0) return mate === -1 ? "Black delivers mate" : `Black is winning (mate in ${Math.abs(mate)})`;
    return "The position is equal.";
  }

  const pawns = evalCp / 100;
  const side = pawns > 0 ? "White" : pawns < 0 ? "Black" : "The position is";
  const abs = Math.abs(pawns);

  if (abs < 0.25) return "The position is roughly equal.";
  if (abs >= 8) return `${side} is completely winning.`;
  if (abs >= 5) return `${side} is decisively better.`;
  if (abs >= 3) return `${side} is clearly better.`;
  if (abs >= 1) return `${side} is better.`;
  return `${side} is slightly better.`;
}
