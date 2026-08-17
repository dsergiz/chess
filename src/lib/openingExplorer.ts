export interface BookMove {
  uci: string;
  san: string;
  whitePct: number;
  drawPct: number;
  blackPct: number;
  totalGames: number;
}

import { localBookMoves } from "@/lib/openings/localBook";
import { loadCachedBookMoves, saveCachedBookMoves } from "@/lib/openings/openingBookCacheDB";

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
  const cached = await loadCachedBookMoves(fen);
  if (cached) return cached;

  const local = localBookMoves(fen);
  if (local.length > 0) return local;

  try {
    const res = await fetch(`/api/opening?fen=${encodeURIComponent(fen)}`);
    if (res.ok) {
      const data = (await res.json()) as LichessExplorerResponse & { moves?: BookMove[] };
      const parsed = parseExplorerMoves(data);
      if (parsed.length > 0) {
        void saveCachedBookMoves(fen, parsed);
        return parsed;
      }
      if (data.moves?.[0] && "whitePct" in data.moves[0]) {
        return data.moves as BookMove[];
      }
      void saveCachedBookMoves(fen, []);
      return [];
    }
  } catch {
    /* fall through */
  }
  return localBookMoves(fen);
}

/** Minimum master-game count for a move to count as established theory, not DB noise. */
const BOOK_MOVE_MIN_GAMES = 5;

/**
 * Book-move presence (uci set) per fen, for move-classification use — driven by the real
 * Lichess Masters database instead of a ply-count heuristic. Fetches with limited concurrency
 * since this typically covers ~20+ positions per full-game review.
 */
export async function fetchBookMoveSets(
  fens: string[],
  concurrency = 6
): Promise<Map<string, Set<string>>> {
  const unique = Array.from(new Set(fens));
  const result = new Map<string, Set<string>>();
  let cursor = 0;

  async function worker() {
    while (cursor < unique.length) {
      const fen = unique[cursor++];
      try {
        const moves = await fetchOpeningBook(fen);
        result.set(
          fen,
          new Set(moves.filter((m) => m.totalGames >= BOOK_MOVE_MIN_GAMES).map((m) => m.uci))
        );
      } catch {
        result.set(fen, new Set());
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, worker));
  return result;
}
