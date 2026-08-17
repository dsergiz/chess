"use client";

import clsx from "clsx";
import type { MultiEngineAnalysis } from "@/types";
import type { BookMove } from "@/lib/openingExplorer";
import type { DetectedOpening } from "@/lib/openings/detectOpening";
import { formatEval } from "@/lib/chess";
import { pvToSanLine } from "@/lib/board/pvDisplay";
import { explainBestMoveIdea } from "@/lib/tactics/motifs";

interface BestMovesPanelProps {
  fen: string;
  analysis: MultiEngineAnalysis | null;
  bookMoves: BookMove[];
  bookLoading?: boolean;
  opening: DetectedOpening | null;
  selectedLineUci?: string | null;
  onSelectLine?: (uci: string, pv: string[]) => void;
  onPlayLine?: (pv: string[]) => void;
  /** What was actually played from this position in the game being reviewed. */
  playedLine?: { san: string; pv: string[] } | null;
}

function formatGames(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return String(n);
}

export function BestMovesPanel({
  fen,
  analysis,
  bookMoves,
  bookLoading,
  opening,
  selectedLineUci,
  onSelectLine,
  onPlayLine,
  playedLine,
}: BestMovesPanelProps) {
  const engineMoves = analysis?.engines[0]?.bestMoves ?? [];
  const playedSanLine = playedLine ? pvToSanLine(fen, playedLine.pv, 4) : "";
  const sideToMove = fen.split(" ")[1] === "b" ? "Black" : "White";

  return (
    <aside
      className="flex flex-col gap-3 w-full shrink-0"
      data-testid="best-moves-panel"
    >
      {opening && (
        <div className="panel px-3 py-2.5" data-testid="opening-info">
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Opening</p>
          <p className="text-sm font-medium text-white mt-0.5">{opening.name}</p>
          <p className="text-xs text-gray-500 font-mono">{opening.eco}</p>
        </div>
      )}

      <div className="panel p-3 space-y-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Engine lines
          </h3>
          {engineMoves.length > 0 && (
            <span className="text-[10px] text-gray-500" data-testid="engine-lines-caption">
              {sideToMove} to move · eval is White's POV
            </span>
          )}
        </div>
        {engineMoves.length === 0 ? (
          <p className="text-xs text-gray-500">Waiting for engine…</p>
        ) : (
          <ul className="space-y-2" data-testid="engine-lines">
            {engineMoves.slice(0, 5).map((move, i) => {
              const pvLine = move.pv.length > 0 ? move.pv : [move.uci];
              const sanLine = pvToSanLine(fen, pvLine, 4);
              const idea =
                i === 0 && move.pv.length >= 2
                  ? explainBestMoveIdea(fen, move.san, move.pv)
                  : null;
              const selected = selectedLineUci === move.uci;

              return (
                <li
                  key={`${move.uci}-${i}`}
                  className={clsx(
                    "rounded-lg border text-sm overflow-hidden",
                    selected ? "border-accent/50 bg-accent/10" : "border-transparent bg-white/5"
                  )}
                  data-testid={i === 0 ? "engine-line-best" : `engine-line-${i + 1}`}
                >
                  <button
                    type="button"
                    className="w-full flex items-baseline gap-2 py-2 px-2 text-left hover:bg-white/5 transition-colors"
                    onClick={() => onSelectLine?.(move.uci, pvLine)}
                  >
                    <span className="text-gray-600 text-xs w-3">{i + 1}</span>
                    <span className="font-mono text-white flex-1">{move.san}</span>
                    <span className="text-gray-500 text-xs tabular-nums">
                      {formatEval(move.score, move.mate)}
                    </span>
                  </button>
                  {sanLine && (
                    <p className="px-2 pb-1 text-[10px] text-gray-500 font-mono leading-snug">
                      {sanLine}
                    </p>
                  )}
                  {idea && (
                    <p className="px-2 pb-2 text-[11px] text-gray-400 leading-snug">{idea}</p>
                  )}
                  {onPlayLine && pvLine.length > 0 && (
                    <div className="px-2 pb-2">
                      <button
                        type="button"
                        data-testid={i === 0 ? "play-best-line" : `play-line-${i + 1}`}
                        className="text-[10px] uppercase tracking-wide text-accent hover:text-white transition-colors"
                        onClick={() => onPlayLine(pvLine)}
                      >
                        ▶ Play line on board
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {playedLine && onPlayLine && (
          <button
            type="button"
            className="w-full rounded-lg border border-transparent bg-white/5 hover:bg-white/10 hover:border-amber-400/40 text-sm text-left overflow-hidden transition-colors"
            data-testid="played-line"
            onClick={() => onPlayLine(playedLine.pv)}
          >
            <div className="flex items-baseline gap-2 py-2 px-2">
              <span className="text-[9px] font-bold uppercase tracking-wide text-amber-400 shrink-0">
                Played
              </span>
              <span className="font-mono text-white flex-1">{playedLine.san}</span>
              <span className="text-[10px] uppercase tracking-wide text-amber-400">
                ▶ diverge
              </span>
            </div>
            {playedSanLine && (
              <p className="px-2 pb-2 text-[10px] text-gray-500 font-mono leading-snug">
                {playedSanLine}
              </p>
            )}
          </button>
        )}
      </div>

      <div className="panel p-3 space-y-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Database
        </h3>
        {bookLoading && bookMoves.length === 0 && (
          <p className="text-xs text-gray-500">Loading…</p>
        )}
        {!bookLoading && bookMoves.length === 0 && (
          <p className="text-xs text-gray-500">No stats for this position.</p>
        )}
        {bookMoves.length > 0 && (
          <div className={clsx("space-y-0 transition-opacity", bookLoading && "opacity-50")}>
            {bookMoves.slice(0, 5).map((move) => {
              const games = move.totalGames ?? 0;
              const total = bookMoves.reduce((s, m) => s + (m.totalGames ?? 0), 0);
              const pct = total > 0 ? Math.round((games / total) * 100) : 0;
              return (
                <div key={move.uci} className="text-sm py-1" data-testid="book-move-row">
                  <div className="flex justify-between">
                    <span className="font-mono text-white">{move.san}</span>
                    <span className="text-xs text-gray-500 tabular-nums" data-testid="book-move-pct">
                      {pct}%
                    </span>
                  </div>
                  <div className="flex h-1 rounded-full overflow-hidden bg-board-border mt-1">
                    <div className="bg-gray-200" style={{ width: `${move.whitePct}%` }} />
                    <div className="bg-gray-500" style={{ width: `${move.drawPct}%` }} />
                    <div className="bg-gray-700" style={{ width: `${move.blackPct}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-600 mt-0.5">{formatGames(games)} games</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
