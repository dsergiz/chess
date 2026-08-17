/** Common opening lines — ECO prefix match on UCI move sequence from game start. */
export interface OpeningLine {
  eco: string;
  name: string;
  uciMoves: string[];
}

export const OPENING_LINES: OpeningLine[] = [
  { eco: "B00", name: "King's Pawn Game", uciMoves: ["e2e4"] },
  { eco: "C20", name: "King's Pawn Game", uciMoves: ["e2e4", "e7e5"] },
  { eco: "C40", name: "King's Knight Opening", uciMoves: ["e2e4", "e7e5", "g1f3"] },
  { eco: "C41", name: "Philidor Defense", uciMoves: ["e2e4", "e7e5", "g1f3", "d7d6"] },
  { eco: "C42", name: "Petrov Defense", uciMoves: ["e2e4", "e7e5", "g1f3", "g8f6"] },
  { eco: "C50", name: "Italian Game", uciMoves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4"] },
  { eco: "C60", name: "Ruy Lopez", uciMoves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5"] },
  { eco: "B20", name: "Sicilian Defense", uciMoves: ["e2e4", "c7c5"] },
  { eco: "B30", name: "Sicilian Defense", uciMoves: ["e2e4", "c7c5", "g1f3"] },
  { eco: "B01", name: "Scandinavian Defense", uciMoves: ["e2e4", "d7d5"] },
  { eco: "C00", name: "French Defense", uciMoves: ["e2e4", "e7e6"] },
  { eco: "B10", name: "Caro-Kann Defense", uciMoves: ["e2e4", "c7c6"] },
  { eco: "D06", name: "Queen's Gambit", uciMoves: ["d2d4", "d7d5", "c2c4"] },
  { eco: "A40", name: "Queen's Pawn Game", uciMoves: ["d2d4"] },
  { eco: "A04", name: "Réti Opening", uciMoves: ["g1f3"] },
  { eco: "A20", name: "English Opening", uciMoves: ["c2c4"] },
];

export interface DetectedOpening {
  eco: string;
  name: string;
  ply: number;
}

export function detectOpeningFromHeaders(headers: Record<string, string>): DetectedOpening | null {
  const eco = headers.ECO ?? headers.eco;
  const name = headers.Opening ?? headers.opening;
  if (eco && name) return { eco, name, ply: 0 };
  if (name) return { eco: eco ?? "—", name, ply: 0 };
  return null;
}

export function detectOpeningFromMoves(uciMoves: string[]): DetectedOpening | null {
  let best: OpeningLine | null = null;
  for (const line of OPENING_LINES) {
    if (line.uciMoves.length > (best?.uciMoves.length ?? 0)) {
      const matches = line.uciMoves.every((m, i) => uciMoves[i] === m);
      if (matches) best = line;
    }
  }
  if (!best) return null;
  return { eco: best.eco, name: best.name, ply: best.uciMoves.length };
}

export function resolveOpening(
  headers: Record<string, string>,
  uciMoves: string[]
): DetectedOpening | null {
  return detectOpeningFromHeaders(headers) ?? detectOpeningFromMoves(uciMoves);
}
