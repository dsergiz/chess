"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import type { ChessComGame } from "@/types";
import { formatGameResult, formatTimeControl, gameTitle, SUGGESTED_USERNAME, type TopPlayer } from "@/lib/chesscom";

interface ImportGameProps {
  onImportPgn: (pgn: string) => void;
  onSelectChessComGame: (game: ChessComGame) => void;
  onLoadDemo?: () => void;
  variant?: "default" | "sidebar";
}

export function ImportGame({
  onImportPgn,
  onSelectChessComGame,
  onLoadDemo,
  variant = "default",
}: ImportGameProps) {
  const [tab, setTab] = useState<"chesscom" | "pgn">("chesscom");
  const [username, setUsername] = useState("");
  const [pgnText, setPgnText] = useState("");
  const [games, setGames] = useState<ChessComGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
  const [topPlayersLoading, setTopPlayersLoading] = useState(true);
  const compact = variant === "sidebar";

  useEffect(() => {
    let cancelled = false;
    fetch("/api/chesscom/leaderboard")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.players) setTopPlayers(data.players);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setTopPlayersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchGames = async (targetUsername?: string) => {
    const uname = (targetUsername ?? username).trim();
    if (!uname) return;
    setUsername(uname);
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/chesscom?username=${encodeURIComponent(uname)}&limit=15`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch");
      if (!data.games?.length) throw new Error("No games found for this player");
      setGames(data.games);
      setSuccess(`Loaded ${data.games.length} games`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch games");
      setGames([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectGame = async (game: ChessComGame) => {
    setImportingId(game.uuid);
    setError(null);
    try {
      onSelectChessComGame(game);
      setSuccess(`Loaded ${gameTitle(game)}`);
    } finally {
      setImportingId(null);
    }
  };

  const handlePgnImport = () => {
    if (!pgnText.trim()) return;
    onImportPgn(pgnText.trim());
    setSuccess("Game imported");
    setPgnText("");
  };

  return (
    <div className="overflow-hidden min-h-0 flex flex-col" data-testid="import-panel">
      <div className="flex border-b border-board-border shrink-0">
        <TabButton active={tab === "chesscom"} onClick={() => setTab("chesscom")} compact={compact}>
          {compact ? "Chess.com" : "♞ Chess.com"}
        </TabButton>
        <TabButton active={tab === "pgn"} onClick={() => setTab("pgn")} compact={compact}>
          {compact ? "PGN" : "📋 Paste PGN"}
        </TabButton>
      </div>

      <div className={clsx("space-y-3 shrink-0", compact ? "p-3" : "p-4")}>
        {tab === "chesscom" && (
          <>
            <div className={clsx(compact ? "flex flex-col gap-2" : "flex gap-2")}>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchGames()}
                placeholder="Username"
                data-testid="username-input"
                className={clsx(
                  "w-full rounded-lg bg-board-bg border border-board-border text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-accent/40 min-h-[44px]",
                  compact ? "px-3 py-2.5 text-sm" : "flex-1 px-4 py-3"
                )}
              />
              <button
                type="button"
                onClick={() => fetchGames()}
                disabled={loading || !username.trim()}
                data-testid="fetch-games-button"
                className={clsx(
                  "rounded-lg bg-accent hover:bg-accent-muted text-white font-semibold disabled:opacity-50 transition-all min-h-[44px] touch-manipulation",
                  compact ? "w-full py-2.5 text-sm" : "px-5 py-3 whitespace-nowrap"
                )}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner /> Loading…
                  </span>
                ) : (
                  "Fetch games"
                )}
              </button>
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-lg" data-testid="import-error">
                {error}
              </p>
            )}
            {success && !error && (
              <p className="text-emerald-400 text-sm bg-emerald-500/10 px-3 py-2 rounded-lg">{success}</p>
            )}

            <div className="space-y-1.5" data-testid="chesscom-suggestions">
              <p className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">
                Games to select from Chess.com
              </p>
              <div className="flex flex-wrap gap-1.5">
                <SuggestionChip
                  label={SUGGESTED_USERNAME}
                  badge="you"
                  disabled={loading}
                  onClick={() => fetchGames(SUGGESTED_USERNAME)}
                />
                {topPlayers.map((p) => (
                  <SuggestionChip
                    key={p.username}
                    label={p.username}
                    badge={p.title}
                    disabled={loading}
                    onClick={() => fetchGames(p.username)}
                  />
                ))}
                {topPlayersLoading && (
                  <span className="text-xs text-gray-600 px-2 py-1.5">Loading top players…</span>
                )}
              </div>
            </div>
          </>
        )}

        {tab === "pgn" && (
          <>
            <textarea
              value={pgnText}
              onChange={(e) => setPgnText(e.target.value)}
              placeholder="Paste PGN here…"
              rows={compact ? 5 : 6}
              data-testid="pgn-input"
              className="w-full rounded-lg bg-board-bg border border-board-border px-3 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-accent/40 font-mono text-sm resize-y min-h-[100px]"
            />
            <button
              type="button"
              onClick={handlePgnImport}
              disabled={!pgnText.trim()}
              data-testid="import-pgn-button"
              className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent-muted text-white font-semibold disabled:opacity-50 transition-all min-h-[44px] touch-manipulation text-sm"
            >
              Import game
            </button>
          </>
        )}
      </div>

      {tab === "chesscom" && (
        <div
          className={clsx(
            "flex-1 min-h-0 overflow-y-auto space-y-1.5 border-t border-board-border",
            compact ? "px-3 py-2 max-h-[50vh]" : "px-4 pb-2 max-h-[280px]"
          )}
        >
          {games.map((game) => (
            <button
              key={game.uuid}
              type="button"
              onClick={() => handleSelectGame(game)}
              disabled={importingId === game.uuid}
              data-testid="game-item"
              className="w-full text-left px-3 py-2.5 rounded-lg bg-board-bg hover:bg-board-hover border border-transparent hover:border-board-border transition-all touch-manipulation disabled:opacity-60"
            >
              <div className="flex justify-between items-start gap-2">
                <span className="text-white font-medium text-sm leading-snug">{gameTitle(game)}</span>
                <span className="text-accent-gold font-mono text-xs shrink-0">
                  {formatGameResult(game)}
                </span>
              </div>
              <div className="text-[11px] text-gray-500 mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                <span>{formatTimeControl(game.timeControl)}</span>
                <span>
                  {game.white.rating} vs {game.black.rating}
                </span>
                {game.moveCount > 0 && (
                  <span>
                    {game.moveCount} move{game.moveCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {onLoadDemo && (
        <div className={clsx("border-t border-board-border shrink-0", compact ? "px-3 py-3" : "px-4 pb-4 pt-3")}>
          <button
            type="button"
            onClick={onLoadDemo}
            data-testid="load-demo-game"
            className="w-full py-2.5 rounded-lg border border-board-border hover:bg-board-hover text-sm text-gray-300 transition-all min-h-[44px] touch-manipulation"
          >
            Try demo game — Légal's Mate
          </button>
        </div>
      )}
    </div>
  );
}

function SuggestionChip({
  label,
  badge,
  disabled,
  onClick,
}: {
  label: string;
  badge?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid="chesscom-suggestion-chip"
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-board-bg border border-board-border hover:border-accent/50 hover:bg-board-hover text-xs text-gray-200 transition-all touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {badge && (
        <span className="text-[10px] font-bold text-accent-gold uppercase leading-none">{badge}</span>
      )}
      {label}
    </button>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function TabButton({
  active,
  onClick,
  compact,
  children,
}: {
  active: boolean;
  onClick: () => void;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex-1 font-medium transition-all touch-manipulation min-h-[44px]",
        compact ? "py-2.5 text-xs" : "py-3 text-sm",
        active
          ? "text-accent border-b-2 border-accent bg-board-hover/50"
          : "text-gray-500 hover:text-gray-200"
      )}
    >
      {children}
    </button>
  );
}
