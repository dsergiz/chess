import type { CSSProperties } from "react";
import { Chess, type Square } from "chess.js";

const PIECE_COLOR: Record<string, "w" | "b"> = {
  wP: "w", wN: "w", wB: "w", wR: "w", wQ: "w", wK: "w",
  bP: "b", bN: "b", bB: "b", bR: "b", bQ: "b", bK: "b",
};

const TYPE_TO_PIECE: Record<string, string> = {
  p: "P", n: "N", b: "B", r: "R", q: "Q", k: "K",
};

export function sideToMove(fen: string): "w" | "b" {
  return fen.split(" ")[1] === "b" ? "b" : "w";
}

export function pieceAt(fen: string, square: Square): string | null {
  const chess = new Chess(fen);
  const p = chess.get(square);
  if (!p) return null;
  const letter = TYPE_TO_PIECE[p.type] ?? p.type.toUpperCase();
  return `${p.color}${letter}`;
}

export function pieceColor(piece: string): "w" | "b" | null {
  return PIECE_COLOR[piece] ?? null;
}

export function legalMovesFrom(fen: string, square: Square) {
  const chess = new Chess(fen);
  return chess.moves({ square, verbose: true });
}

export function kingInCheckSquare(fen: string): Square | null {
  const chess = new Chess(fen);
  if (!chess.inCheck()) return null;
  const color = chess.turn();
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (p?.type === "k" && p.color === color) {
        const file = String.fromCharCode(97 + f);
        const rank = 8 - r;
        return `${file}${rank}` as Square;
      }
    }
  }
  return null;
}

/** Lichess-style move dots and capture rings via CSS backgrounds. */
export function buildMoveHintStyles(
  selected: Square | null,
  targets: ReturnType<typeof legalMovesFrom>
): Record<string, CSSProperties> {
  const styles: Record<string, CSSProperties> = {};

  if (selected) {
    styles[selected] = {
      backgroundColor: "rgba(255, 255, 100, 0.45)",
      boxShadow: "inset 0 0 0 3px rgba(255, 255, 100, 0.6)",
    };
  }

  for (const move of targets) {
    const isCapture = Boolean(move.captured);
    styles[move.to] = isCapture
      ? {
          background:
            "radial-gradient(transparent 0%, transparent 68%, rgba(0,0,0,0.25) 69%, rgba(0,0,0,0.25) 78%, transparent 79%)",
          backgroundColor: "rgba(20, 85, 30, 0.35)",
        }
      : {
          background:
            "radial-gradient(circle, rgba(0,0,0,0.22) 19%, transparent 20%)",
        };
  }

  return styles;
}

export function tryMove(
  fen: string,
  from: Square,
  to: Square,
  promotion?: "q" | "r" | "b" | "n"
): { ok: true; fen: string } | { ok: false } {
  const chess = new Chess(fen);
  try {
    const move = chess.move({ from, to, promotion: promotion ?? "q" });
    if (!move) return { ok: false };
    return { ok: true, fen: chess.fen() };
  } catch {
    return { ok: false };
  }
}

export function needsPromotion(fen: string, from: Square, to: Square): boolean {
  const chess = new Chess(fen);
  const piece = chess.get(from);
  if (!piece || piece.type !== "p") return false;
  return (piece.color === "w" && to[1] === "8") || (piece.color === "b" && to[1] === "1");
}

const CASTLING_ROOK_MOVES: Record<string, { from: Square; to: Square }> = {
  "w:O-O": { from: "h1", to: "f1" },
  "w:O-O-O": { from: "a1", to: "d1" },
  "b:O-O": { from: "h8", to: "f8" },
  "b:O-O-O": { from: "a8", to: "d8" },
};

/** The rook's move that accompanies a castling SAN ("O-O"/"O-O-O"), or null if not a castle. */
export function castlingRookMove(san: string, color: "w" | "b"): { from: Square; to: Square } | null {
  const normalized = san.replace(/[+#!?]+$/g, "");
  return CASTLING_ROOK_MOVES[`${color}:${normalized}`] ?? null;
}
