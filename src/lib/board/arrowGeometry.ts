import type { Square } from "chess.js";

export type BoardArrow = [Square, Square, string?];

const FILE_INDEX: Record<string, number> = {
  a: 0,
  b: 1,
  c: 2,
  d: 3,
  e: 4,
  f: 5,
  g: 6,
  h: 7,
};

export function squareCenter(
  square: Square,
  boardWidth: number,
  orientation: "white" | "black"
): { x: number; y: number } {
  const squareWidth = boardWidth / 8;
  const file = FILE_INDEX[square[0]] ?? 0;
  const rank = parseInt(square[1], 10) - 1;

  let col = file;
  let row = 7 - rank;
  if (orientation === "black") {
    col = 7 - file;
    row = rank;
  }

  return {
    x: col * squareWidth + squareWidth / 2,
    y: row * squareWidth + squareWidth / 2,
  };
}

export function isKnightMove(from: Square, to: Square): boolean {
  const df = Math.abs((FILE_INDEX[to[0]] ?? 0) - (FILE_INDEX[from[0]] ?? 0));
  const dr = Math.abs(parseInt(to[1], 10) - parseInt(from[1], 10));
  return (df === 1 && dr === 2) || (df === 2 && dr === 1);
}

/** Chess.com-style L corner for a knight hop. */
export function knightCornerSquare(from: Square, to: Square): Square {
  const df = (FILE_INDEX[to[0]] ?? 0) - (FILE_INDEX[from[0]] ?? 0);
  if (Math.abs(df) === 2) {
    return `${to[0]}${from[1]}` as Square;
  }
  return `${from[0]}${to[1]}` as Square;
}

export function shortenSegment(
  from: { x: number; y: number },
  to: { x: number; y: number },
  trim: number
): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const usable = Math.max(0, len - trim);
  return {
    x: from.x + (dx * usable) / len,
    y: from.y + (dy * usable) / len,
  };
}

export interface ArrowSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** One or two segments (knight L) with shortened ends for arrowheads. */
export function buildArrowSegments(
  from: Square,
  to: Square,
  boardWidth: number,
  orientation: "white" | "black"
): ArrowSegment[] {
  const trim = boardWidth / 32;
  const start = squareCenter(from, boardWidth, orientation);
  const endFull = squareCenter(to, boardWidth, orientation);

  if (isKnightMove(from, to)) {
    const corner = squareCenter(knightCornerSquare(from, to), boardWidth, orientation);
    const leg1End = shortenSegment(start, corner, trim * 0.35);
    const leg2End = shortenSegment(corner, endFull, trim);
    return [
      { x1: start.x, y1: start.y, x2: leg1End.x, y2: leg1End.y },
      { x1: corner.x, y1: corner.y, x2: leg2End.x, y2: leg2End.y },
    ];
  }

  const end = shortenSegment(start, endFull, trim);
  return [{ x1: start.x, y1: start.y, x2: end.x, y2: end.y }];
}

export const USER_ARROW_COLORS = {
  default: "rgba(129, 182, 76, 0.92)",
  shift: "rgba(235, 87, 87, 0.92)",
  alt: "rgba(96, 165, 250, 0.92)",
} as const;

export function userArrowColor(modifiers: { shiftKey: boolean; altKey: boolean }): string {
  if (modifiers.shiftKey) return USER_ARROW_COLORS.shift;
  if (modifiers.altKey) return USER_ARROW_COLORS.alt;
  return USER_ARROW_COLORS.default;
}
