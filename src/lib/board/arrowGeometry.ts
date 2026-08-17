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

type Point = { x: number; y: number };

function unitVector(dx: number, dy: number): Point {
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

function perpVector(dx: number, dy: number): Point {
  const u = unitVector(dx, dy);
  return { x: -u.y, y: u.x };
}

/** Rectangle (as 4 corners) for a constant-width segment from p1 to p2. */
function shaftRect(p1: Point, p2: Point, halfWidth: number): Point[] {
  const n = perpVector(p2.x - p1.x, p2.y - p1.y);
  const ox = n.x * halfWidth;
  const oy = n.y * halfWidth;
  return [
    { x: p1.x + ox, y: p1.y + oy },
    { x: p2.x + ox, y: p2.y + oy },
    { x: p2.x - ox, y: p2.y - oy },
    { x: p1.x - ox, y: p1.y - oy },
  ];
}

function polygonPath(points: Point[]): string {
  return `M ${points.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" L ")} Z`;
}

/**
 * SVG path `d` for one chess.com-style arrow: a constant-width rectangular
 * shaft (with a hard right-angle bend for knight moves) ending in a wide
 * flat-backed triangular head. Built as filled polygon subpaths inside a
 * single path (rendered with fill, no stroke) so the knight elbow reads as
 * one solid shape instead of two thin bolted-together lines.
 */
export function buildArrowShape(
  from: Square,
  to: Square,
  boardWidth: number,
  orientation: "white" | "black"
): string {
  const squareWidth = boardWidth / 8;
  const shaftHalfWidth = squareWidth * 0.12;
  const headHalfWidth = squareWidth * 0.3;
  const headLength = squareWidth * 0.55;

  const start = squareCenter(from, boardWidth, orientation);
  const tip = squareCenter(to, boardWidth, orientation);

  const headDirSource = isKnightMove(from, to)
    ? squareCenter(knightCornerSquare(from, to), boardWidth, orientation)
    : start;
  const headDir = unitVector(tip.x - headDirSource.x, tip.y - headDirSource.y);
  const headBase: Point = {
    x: tip.x - headDir.x * headLength,
    y: tip.y - headDir.y * headLength,
  };
  const headPerp = perpVector(headDir.x, headDir.y);
  const head = polygonPath([
    { x: headBase.x + headPerp.x * headHalfWidth, y: headBase.y + headPerp.y * headHalfWidth },
    tip,
    { x: headBase.x - headPerp.x * headHalfWidth, y: headBase.y - headPerp.y * headHalfWidth },
  ]);

  if (isKnightMove(from, to)) {
    const corner = squareCenter(knightCornerSquare(from, to), boardWidth, orientation);
    const leg1 = polygonPath(shaftRect(start, corner, shaftHalfWidth));
    const leg2 = polygonPath(shaftRect(corner, headBase, shaftHalfWidth));
    return [leg1, leg2, head].join(" ");
  }

  const shaft = polygonPath(shaftRect(start, headBase, shaftHalfWidth));
  return [shaft, head].join(" ");
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
