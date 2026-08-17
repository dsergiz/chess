import type { BookMove } from "@/lib/openingExplorer";

/** Approximate master stats when remote explorer is unavailable. */
const LOCAL_BOOK: Record<string, BookMove[]> = {
  start: [
    { uci: "e2e4", san: "e4", whitePct: 37, drawPct: 32, blackPct: 31, totalGames: 520000 },
    { uci: "d2d4", san: "d4", whitePct: 36, drawPct: 35, blackPct: 29, totalGames: 410000 },
    { uci: "g1f3", san: "Nf3", whitePct: 35, drawPct: 34, blackPct: 31, totalGames: 95000 },
    { uci: "c2c4", san: "c4", whitePct: 34, drawPct: 36, blackPct: 30, totalGames: 88000 },
  ],
};

export function localBookMoves(fen: string): BookMove[] {
  const board = fen.split(" ")[0];
  const isStart =
    board === "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR" &&
    fen.includes(" w ") &&
    fen.includes(" 0 1");
  if (isStart) return LOCAL_BOOK.start;
  return [];
}
