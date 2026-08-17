"use client";

import clsx from "clsx";
import { formatEvalLabel } from "@/lib/chess";
import {
  whitePercentFromWinningChances,
  winningChancesWhitePov,
} from "@/lib/eval/winningChances";

interface BoardEvalBarProps {
  evalScore?: number;
  mate?: number;
  orientation?: "white" | "black";
  height: number;
  isLoading?: boolean;
  className?: string;
}

export function BoardEvalBar({
  evalScore,
  mate,
  orientation = "white",
  height,
  isLoading,
  className,
}: BoardEvalBarProps) {
  const hasEval = evalScore !== undefined || mate !== undefined;

  let whitePercent = 50;
  if (hasEval) {
    const chances = winningChancesWhitePov(evalScore ?? 0, mate);
    whitePercent = whitePercentFromWinningChances(chances);
    if (mate === undefined) {
      whitePercent = Math.max(4, Math.min(96, whitePercent));
    } else {
      whitePercent = mate > 0 ? 100 : mate < 0 ? 0 : 50;
    }
  }

  const displayEval = hasEval ? formatEvalLabel(evalScore ?? 0, mate, "w") : "—";
  const whiteAtBottom = orientation === "white";

  return (
    <div
      className={clsx("flex flex-col items-center shrink-0 self-stretch", className)}
      data-testid="board-eval-bar"
      style={{ height: Math.max(height, 280) }}
    >
      <div
        className={clsx(
          "relative w-5 sm:w-6 flex-1 min-h-[200px] rounded-sm overflow-hidden border border-[#1a1816]",
          !hasEval && "opacity-40",
          isLoading && !hasEval && "animate-pulse"
        )}
        aria-label={hasEval ? `Evaluation ${displayEval}` : "Evaluation loading"}
      >
        <div className="absolute inset-0 bg-[#403d39]" />
        <div
          className={clsx(
            "absolute left-0 right-0 bg-[#eeeed2] transition-[height] duration-300 ease-out",
            isLoading && hasEval && "opacity-90"
          )}
          style={{
            height: `${whitePercent}%`,
            ...(whiteAtBottom ? { bottom: 0 } : { top: 0 }),
          }}
        />
        {hasEval && (
          <span
            className={clsx(
              "absolute left-1/2 -translate-x-1/2 text-[9px] sm:text-[10px] font-bold tabular-nums pointer-events-none z-10 px-0.5 rounded whitespace-nowrap",
              whitePercent >= 50
                ? whiteAtBottom
                  ? "bottom-1 text-[#403d39]"
                  : "top-1 text-[#403d39]"
                : whiteAtBottom
                  ? "top-1 text-[#eeeed2]"
                  : "bottom-1 text-[#eeeed2]"
            )}
          >
            {displayEval}
          </span>
        )}
      </div>
    </div>
  );
}

/** Exported for tests — bar fill % from white-POV engine scores. */
export function evalBarWhitePercent(evalScore: number, mate?: number): number {
  const chances = winningChancesWhitePov(evalScore, mate);
  let whitePercent = whitePercentFromWinningChances(chances);
  if (mate === undefined) {
    return Math.max(4, Math.min(96, whitePercent));
  }
  return mate > 0 ? 100 : mate < 0 ? 0 : 50;
}
