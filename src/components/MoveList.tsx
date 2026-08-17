"use client";

import { forwardRef, useEffect, useRef } from "react";
import clsx from "clsx";
import type { MoveClassification } from "@/types";
import { pathToPly } from "@/lib/chess";
import type { ImportedGame } from "@/types";

const CLASSIFICATION_STYLES: Record<
  MoveClassification,
  { bg: string; text: string; label: string }
> = {
  brilliant: { bg: "bg-cyan-500/20", text: "text-cyan-300", label: "!!" },
  great: { bg: "bg-teal-500/20", text: "text-teal-300", label: "!" },
  best: { bg: "bg-emerald-500/20", text: "text-emerald-300", label: "Best" },
  excellent: { bg: "bg-green-500/20", text: "text-green-300", label: "✓" },
  good: { bg: "bg-lime-500/20", text: "text-lime-300", label: "Good" },
  book: { bg: "bg-blue-500/20", text: "text-blue-300", label: "Book" },
  inaccuracy: { bg: "bg-yellow-500/20", text: "text-yellow-300", label: "?!" },
  mistake: { bg: "bg-orange-500/20", text: "text-orange-300", label: "?" },
  blunder: { bg: "bg-red-500/20", text: "text-red-300", label: "??" },
  miss: { bg: "bg-purple-500/20", text: "text-purple-300", label: "Miss" },
};

interface MoveListProps {
  game: ImportedGame;
  moves: { san: string; ply: number; color: "w" | "b" }[];
  currentPly: number;
  onSelectPly: (ply: number) => void;
  classifications?: Map<number, MoveClassification>;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  variant?: "default" | "sidebar";
}

function formatMoveSummary(game: ImportedGame, currentPly: number): string {
  if (currentPly <= 0) return "Starting position";
  const path = pathToPly(game, currentPly);
  if (path.length <= 28) return path;
  return `…${path.slice(-25)}`;
}

export function MoveList({
  game,
  moves,
  currentPly,
  onSelectPly,
  classifications,
  expanded = false,
  onExpandedChange,
  variant = "default",
}: MoveListProps) {
  const isSidebar = variant === "sidebar";
  const listClassName = clsx(
    "overflow-y-auto",
    isSidebar ? "max-h-[200px] lg:max-h-[220px]" : "max-h-[220px] md:max-h-[320px]"
  );
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const rows: { num: number; white?: typeof moves[0]; black?: typeof moves[0] }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({
      num: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  useEffect(() => {
    if (!expanded || !activeRef.current || !listRef.current) return;
    activeRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentPly, expanded]);

  const summary = formatMoveSummary(game, currentPly);
  const moveLabel =
    currentPly === 0
      ? "Start"
      : `${Math.ceil(currentPly / 2)}${currentPly % 2 === 1 ? "." : "…"}`;

  return (
    <div className="panel flex flex-col min-h-0 relative z-10" data-testid="move-list-panel">
      <button
        type="button"
        onClick={() => onExpandedChange?.(!expanded)}
        className={clsx(
          "w-full border-b border-board-border flex items-center justify-between gap-2 hover:bg-board-hover/40 touch-manipulation min-h-[44px] scroll-mt-20",
          isSidebar ? "px-3 py-2.5" : "px-4 py-3"
        )}
        aria-expanded={expanded}
        data-testid="move-list-toggle"
      >
        {isSidebar ? (
          <>
            <span className="font-semibold text-sm text-gray-200">Moves</span>
            <span className="text-xs text-gray-500 tabular-nums flex items-center gap-2">
              {currentPly}/{moves.length}
              <span>{expanded ? "▾" : "▸"}</span>
            </span>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 min-w-0 text-left">
              <span className="font-semibold text-gray-200 shrink-0">Move list</span>
              <span className="text-xs text-gray-500 shrink-0 tabular-nums">
                {moveLabel} · {currentPly}/{moves.length}
              </span>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              {!expanded && (
                <span className="text-xs text-gray-400 truncate hidden sm:inline">{summary}</span>
              )}
              <span className="text-gray-500 text-sm shrink-0">{expanded ? "▾" : "▸"}</span>
            </div>
          </>
        )}
      </button>

      {expanded && (
      <div ref={listRef} className={listClassName} data-testid="move-list">
          <div className="grid grid-cols-[2.5rem_1fr_1fr] gap-0 text-sm sticky top-0 bg-board-panel border-b border-board-border px-2 py-2 font-medium text-gray-500 z-10">
            <span>#</span>
            <span>White</span>
            <span>Black</span>
          </div>
          {rows.map((row) => (
            <div
              key={row.num}
              className="grid grid-cols-[2.5rem_1fr_1fr] gap-0 px-2 py-0.5 hover:bg-board-hover/50"
            >
              <span className="text-gray-500 py-2">{row.num}</span>
              {row.white ? (
                <MoveCell
                  ref={row.white.ply === currentPly ? activeRef : undefined}
                  move={row.white}
                  currentPly={currentPly}
                  onSelect={onSelectPly}
                  classification={classifications?.get(row.white.ply)}
                />
              ) : (
                <span />
              )}
              {row.black ? (
                <MoveCell
                  ref={row.black.ply === currentPly ? activeRef : undefined}
                  move={row.black}
                  currentPly={currentPly}
                  onSelect={onSelectPly}
                  classification={classifications?.get(row.black.ply)}
                />
              ) : (
                <span />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const MoveCell = forwardRef(function MoveCell(
  {
    move,
    currentPly,
    onSelect,
    classification,
  }: {
    move: { san: string; ply: number };
    currentPly: number;
    onSelect: (ply: number) => void;
    classification?: MoveClassification;
  },
  ref: React.ForwardedRef<HTMLButtonElement>
) {
  const isActive = move.ply === currentPly;
  const style = classification ? CLASSIFICATION_STYLES[classification] : null;

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onSelect(move.ply)}
      className={clsx(
        "flex items-center gap-1.5 rounded-lg px-2 py-2 text-left transition-all touch-manipulation min-h-[44px]",
        isActive && "bg-accent/15 ring-1 ring-accent/40",
        !isActive && "hover:bg-board-hover"
      )}
    >
      <span className="font-mono">{move.san}</span>
      {style && (
        <span className={clsx("text-xs px-1.5 py-0.5 rounded", style.bg, style.text)}>
          {style.label}
        </span>
      )}
    </button>
  );
});

export { CLASSIFICATION_STYLES };
