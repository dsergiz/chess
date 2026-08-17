import { Chess } from "chess.js";
import type { ChessComGame } from "@/types";

const CHESS_COM_BASE = "https://api.chess.com/pub";

/** Full-move count (e.g. "1. e4 e5" counts as 1) parsed from the game's PGN. */
function moveCountFromPgn(pgn: string): number {
  try {
    const chess = new Chess();
    chess.loadPgn(pgn, { strict: false });
    return Math.ceil(chess.history().length / 2);
  } catch {
    return 0;
  }
}

/** Raw shape returned by chess.com public API (snake_case). */
interface ChessComRawGame {
  uuid: string;
  url: string;
  pgn: string;
  time_control?: string;
  timeControl?: string;
  end_time?: number;
  endTime?: number;
  rated?: boolean;
  white: { username: string; rating: number; result: string };
  black: { username: string; rating: number; result: string };
}

export function normalizeChessComGame(raw: ChessComRawGame): ChessComGame {
  return {
    uuid: raw.uuid,
    url: raw.url,
    pgn: raw.pgn,
    timeControl: raw.time_control ?? raw.timeControl ?? "?",
    endTime: raw.end_time ?? raw.endTime ?? 0,
    rated: raw.rated ?? false,
    moveCount: moveCountFromPgn(raw.pgn),
    white: raw.white,
    black: raw.black,
  };
}

export async function fetchPlayerArchives(username: string): Promise<string[]> {
  const res = await fetch(`${CHESS_COM_BASE}/player/${username.toLowerCase()}/games/archives`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`Player "${username}" not found or archives unavailable`);
  }
  const data = (await res.json()) as { archives: string[] };
  return [...data.archives].reverse();
}

export async function fetchGamesFromArchive(archiveUrl: string): Promise<ChessComGame[]> {
  const res = await fetch(archiveUrl, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error("Failed to fetch archive");
  const data = (await res.json()) as { games: ChessComRawGame[] };
  return data.games.reverse().map(normalizeChessComGame);
}

export async function fetchRecentGames(username: string, limit = 20): Promise<ChessComGame[]> {
  const archives = await fetchPlayerArchives(username);
  const games: ChessComGame[] = [];
  let lastError: unknown = null;

  for (const archive of archives) {
    if (games.length >= limit) break;
    try {
      const batch = await fetchGamesFromArchive(archive);
      games.push(...batch);
    } catch (err) {
      // Chess.com sometimes lists the current month's archive before it's actually
      // populated, returning 404 — skip it and keep trying older months rather than
      // failing the whole import over one archive.
      lastError = err;
    }
  }

  if (games.length === 0 && lastError) {
    throw lastError instanceof Error ? lastError : new Error("Failed to fetch games");
  }

  return games.slice(0, limit);
}

export function formatGameResult(game: ChessComGame): string {
  const w = game.white.result;
  const b = game.black.result;
  if (w === "win") return "1-0";
  if (b === "win") return "0-1";
  if (w === "draw" || b === "draw") return "½-½";
  if (w === "resigned" || b === "resigned") {
    return w === "resigned" ? "0-1" : "1-0";
  }
  if (w === "checkmated" || b === "checkmated") {
    return w === "checkmated" ? "0-1" : "1-0";
  }
  return "*";
}

export function formatTimeControl(tc: string): string {
  if (!tc || tc === "?") return "Unknown";
  if (tc.includes("+")) {
    const [base, inc] = tc.split("+");
    const mins = Math.round(parseInt(base, 10) / 60);
    return `${mins}+${inc}`;
  }
  const secs = parseInt(tc, 10);
  if (!Number.isNaN(secs) && secs >= 60) return `${Math.round(secs / 60)} min`;
  return tc;
}

export function gameTitle(game: ChessComGame): string {
  return `${game.white.username} vs ${game.black.username}`;
}

/** The app's only user — always offered first in the quick-select list. */
export const SUGGESTED_USERNAME = "sir_blunder_lots";

export interface TopPlayer {
  username: string;
  title?: string;
  name?: string;
  rank: number;
}

interface ChessComLeaderboardEntry {
  username: string;
  title?: string;
  name?: string;
  rank: number;
}

/** Live blitz leaderboard — chess.com's most-followed category, so names are recognizable. */
export async function fetchTopPlayers(limit = 10): Promise<TopPlayer[]> {
  const res = await fetch(`${CHESS_COM_BASE}/leaderboards`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error("Failed to fetch leaderboard");
  const data = (await res.json()) as { live_blitz: ChessComLeaderboardEntry[] };
  return data.live_blitz.slice(0, limit).map((p) => ({
    username: p.username,
    title: p.title,
    name: p.name,
    rank: p.rank,
  }));
}
