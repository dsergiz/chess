export interface BookMove {
  uci: string;
  san: string;
  whitePct: number;
  drawPct: number;
  blackPct: number;
  totalGames: number;
}

import { localBookMoves } from "@/lib/openings/localBook";

interface LichessExplorerMove {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
}

interface LichessExplorerResponse {
  moves?: LichessExplorerMove[];
  opening?: { eco: string; name: string };
}

export function parseExplorerOpening(data: LichessExplorerResponse): { eco: string; name: string } | null {
  if (data.opening?.name) {
    return { eco: data.opening.eco ?? "—", name: data.opening.name };
  }
  return null;
}

export function parseExplorerMoves(data: LichessExplorerResponse): BookMove[] {
  if (!data.moves?.length) return [];

  return data.moves
    .map((move) => {
      const total = move.white + move.draws + move.black;
      if (total <= 0) return null;
      return {
        uci: move.uci,
        san: move.san,
        whitePct: (move.white / total) * 100,
        drawPct: (move.draws / total) * 100,
        blackPct: (move.black / total) * 100,
        totalGames: total,
      };
    })
    .filter((m): m is BookMove => m !== null)
    .sort((a, b) => b.totalGames - a.totalGames)
    .slice(0, 6);
}

export async function fetchOpeningBook(fen: string): Promise<BookMove[]> {
  try {
    const res = await fetch(`/api/opening?fen=${encodeURIComponent(fen)}`);
    if (res.ok) {
      const data = (await res.json()) as LichessExplorerResponse & { moves?: BookMove[] };
      const parsed = parseExplorerMoves(data);
      if (parsed.length > 0) return parsed;
      if (data.moves?.[0] && "whitePct" in data.moves[0]) {
        return data.moves as BookMove[];
      }
    }
  } catch {
    /* fall through */
  }
  return localBookMoves(fen);
}
