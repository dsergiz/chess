import type { Square } from "chess.js";
import { Chess, uciToSan } from "@/lib/chess";
import type { EngineMove } from "@/types";

const LINE_COLORS = [
  "rgba(129, 182, 76, 0.95)",
  "rgba(96, 165, 250, 0.85)",
  "rgba(250, 204, 21, 0.8)",
  "rgba(192, 132, 252, 0.75)",
];

export type BoardArrow = [Square, Square, string?];

export function pvToArrows(
  fen: string,
  pv: string[],
  maxMoves = 2,
  onlySide?: "w" | "b"
): BoardArrow[] {
  const arrows: BoardArrow[] = [];
  let position = fen;

  for (let i = 0; i < Math.min(maxMoves, pv.length); i++) {
    const uci = pv[i];
    if (!uci || uci.length < 4) break;

    const mover = new Chess(position).turn();
    if (onlySide && mover !== onlySide) break;

    const from = uci.slice(0, 2) as Square;
    const to = uci.slice(2, 4) as Square;
    arrows.push([from, to, LINE_COLORS[i] ?? LINE_COLORS[0]]);

    try {
      const chess = new Chess(position);
      chess.move({
        from,
        to,
        promotion: uci.length > 4 ? (uci[4] as "q" | "r" | "b" | "n") : undefined,
      });
      position = chess.fen();
    } catch {
      break;
    }
  }

  return arrows;
}

export function buildLineArrowsFromMoves(
  fen: string,
  moves: EngineMove[],
  maxLines = 3,
  pvPlies = 2,
  onlySide?: "w" | "b"
): BoardArrow[] {
  const arrows: BoardArrow[] = [];
  moves.slice(0, maxLines).forEach((move, lineIndex) => {
    const color = LINE_COLORS[lineIndex] ?? LINE_COLORS[0];
    let position = fen;
    for (let i = 0; i < Math.min(pvPlies, move.pv.length); i++) {
      const uci = move.pv[i];
      if (!uci || uci.length < 4) break;

      const mover = new Chess(position).turn();
      if (onlySide && mover !== onlySide) break;

      arrows.push([uci.slice(0, 2) as Square, uci.slice(2, 4) as Square, color]);

      try {
        const chess = new Chess(position);
        chess.move({
          from: uci.slice(0, 2) as Square,
          to: uci.slice(2, 4) as Square,
          promotion: uci.length > 4 ? (uci[4] as "q" | "r" | "b" | "n") : undefined,
        });
        position = chess.fen();
      } catch {
        break;
      }
    }
  });
  return arrows;
}

export function pvToSanLine(fen: string, pv: string[], maxPlies = 4): string {
  const parts: string[] = [];
  let position = fen;

  for (let i = 0; i < Math.min(maxPlies, pv.length); i++) {
    const uci = pv[i];
    if (!uci) break;
    try {
      const san = uciToSan(position, uci);
      parts.push(san);
      const chess = new Chess(position);
      chess.move({
        from: uci.slice(0, 2) as Square,
        to: uci.slice(2, 4) as Square,
        promotion: uci.length > 4 ? (uci[4] as "q" | "r" | "b" | "n") : undefined,
      });
      position = chess.fen();
    } catch {
      break;
    }
  }

  return parts.join(" ");
}

export function applyUciLine(fen: string, pv: string[], plyCount: number): string | null {
  try {
    const chess = new Chess(fen);
    for (let i = 0; i < plyCount && i < pv.length; i++) {
      const uci = pv[i];
      chess.move({
        from: uci.slice(0, 2) as Square,
        to: uci.slice(2, 4) as Square,
        promotion: uci.length > 4 ? (uci[4] as "q" | "r" | "b" | "n") : undefined,
      });
    }
    return chess.fen();
  } catch {
    return null;
  }
}

export { LINE_COLORS };
