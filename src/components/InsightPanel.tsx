"use client";

import clsx from "clsx";
import type { PositionCommentary } from "@/types";

interface InsightPanelProps {
  commentary: PositionCommentary | null;
  isAnalyzing: boolean;
  compact?: boolean;
}

const AGREEMENT_STYLES = {
  aligned: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  partial: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  divergent: "text-red-300 border-red-500/40 bg-red-500/10",
} as const;

const AGREEMENT_LABELS = {
  aligned: "Coach ↔ Stockfish agree",
  partial: "Coach partly differs",
  divergent: "Coach diverges from Stockfish",
} as const;

export function InsightPanel({ commentary, isAnalyzing, compact }: InsightPanelProps) {
  if (!commentary && !isAnalyzing) {
    if (compact) {
      return (
        <div className="panel p-3" data-testid="commentary-panel-empty">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-1.5">Position insight</p>
          <p className="text-sm text-gray-500 leading-relaxed">
            Stockfish updates each move. Deep analyze adds a coach line and checks alignment.
          </p>
        </div>
      );
    }
    return null;
  }

  const alignment = commentary?.alignment;

  return (
    <div
      className={clsx("panel space-y-2", compact ? "p-3 space-y-2.5" : "p-4 space-y-3")}
      data-testid="commentary-panel"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
          Position insight
        </h3>
        {alignment?.coachLine && (
          <span
            className={clsx(
              "text-[10px] px-1.5 py-0.5 rounded border shrink-0",
              AGREEMENT_STYLES[alignment.agreement]
            )}
            data-testid="coach-alignment-badge"
          >
            {AGREEMENT_LABELS[alignment.agreement]}
          </span>
        )}
      </div>

      {isAnalyzing && !commentary && (
        <p className="text-sm text-gray-500 animate-pulse">Merging Stockfish + coach…</p>
      )}

      {commentary && (
        <>
          <p className="text-gray-100 text-sm leading-relaxed" data-testid="insight-summary">
            {commentary.summary}
          </p>

          {alignment && (
            <div className="space-y-1.5 text-xs" data-testid="coach-engine-compare">
              <p className="text-gray-500">
                <span className="text-gray-400">Stockfish:</span> {alignment.engineLine}
              </p>
              {alignment.coachLine && (
                <p className="text-gray-500">
                  <span className="text-gray-400">Coach:</span> {alignment.coachLine}
                </p>
              )}
              {alignment.reasons.length > 0 && (
                <ul className="text-[11px] text-amber-200/90 space-y-0.5">
                  {alignment.reasons.map((reason) => (
                    <li key={reason}>· {reason}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {commentary.bestLineExplanation && (
            <div className="pt-2 border-t border-board-border">
              <p className="text-[11px] uppercase text-gray-500 mb-1">Best plan</p>
              <p className="text-sm text-gray-200 leading-relaxed">{commentary.bestLineExplanation}</p>
            </div>
          )}

          {commentary.engineNotes.length > 0 && (
            <p className="text-[10px] text-gray-600">{commentary.engineNotes.join(" · ")}</p>
          )}
        </>
      )}
    </div>
  );
}
