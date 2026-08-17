"use client";

import clsx from "clsx";
import type { AnalysisMode } from "@/lib/engines/analysisModes";
import { ANALYSIS_MODE_LABELS } from "@/lib/engines/analysisModes";
import { formatEval, formatEvalLabel } from "@/lib/chess";
import type { PositionCommentary } from "@/types";
import { InsightPanel } from "./InsightPanel";

const MODES: AnalysisMode[] = ["fast", "deep", "tactical", "compare"];

interface EngineRailProps {
  evalScore?: number;
  mate?: number;
  analysisMode: AnalysisMode;
  onAnalysisModeChange: (mode: AnalysisMode) => void;
  onDeepAnalyze: () => void;
  isDeepAnalyzing: boolean;
  analysisProgress?: string | null;
  modeNeedsRefresh?: boolean;
  engineExpanded: boolean;
  onEngineExpandedChange: (expanded: boolean) => void;
  commentary: PositionCommentary | null;
  className?: string;
}

export function EngineRail({
  evalScore,
  mate,
  analysisMode,
  onAnalysisModeChange,
  onDeepAnalyze,
  isDeepAnalyzing,
  analysisProgress,
  modeNeedsRefresh,
  engineExpanded,
  onEngineExpandedChange,
  commentary,
  className,
}: EngineRailProps) {
  const hasEval = evalScore !== undefined || mate !== undefined;
  const evalStr = hasEval ? formatEvalLabel(evalScore ?? 0, mate, "w") : "—";

  return (
    <aside
      className={clsx(
        "flex flex-col gap-2 w-full lg:w-[19rem] lg:min-w-[19rem] shrink-0 max-h-[calc(100dvh-5.5rem)] overflow-y-auto",
        className
      )}
      data-testid="engine-rail"
    >
      <div className="panel p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">Eval</p>
            <p className="text-[10px] text-gray-600">Stockfish · white POV</p>
          </div>
          <p className="text-xl font-bold tabular-nums text-white" data-testid="eval-display">
            {evalStr}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onEngineExpandedChange(!engineExpanded)}
          className="w-full flex items-center justify-between px-1 py-1.5 text-xs font-semibold text-gray-300 hover:text-white touch-manipulation"
          aria-expanded={engineExpanded}
          data-testid="engine-section-toggle"
        >
          <span>Engine</span>
          <span className="text-gray-500">{engineExpanded ? "▾" : "▸"}</span>
        </button>

        {engineExpanded && (
          <div className="space-y-2 pt-0.5" data-testid="engine-section">
            <div className="flex flex-col gap-1" data-testid="analysis-mode-select">
              {MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  disabled={isDeepAnalyzing}
                  onClick={() => onAnalysisModeChange(mode)}
                  data-testid={`analysis-mode-${mode}`}
                  className={clsx(
                    "px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-all text-left touch-manipulation",
                    analysisMode === mode
                      ? "bg-accent/15 border-accent/40 text-accent"
                      : "border-board-border text-gray-500 hover:text-gray-200 hover:border-gray-500",
                    isDeepAnalyzing && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {mode === "fast"
                    ? "Fast"
                    : mode === "deep"
                      ? "Deep"
                      : mode === "tactical"
                        ? "Tactical"
                        : "Compare"}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-600 leading-snug px-0.5">
              {ANALYSIS_MODE_LABELS[analysisMode]}
            </p>
            {modeNeedsRefresh && !isDeepAnalyzing && (
              <p className="text-[10px] text-amber-400/90 px-0.5" data-testid="mode-needs-refresh">
                Run deep analyze for this mode.
              </p>
            )}
            <button
              type="button"
              onClick={onDeepAnalyze}
              disabled={isDeepAnalyzing}
              data-testid="analyze-button"
              className={clsx(
                "w-full px-2 py-2 rounded-lg text-xs font-semibold transition-all touch-manipulation",
                "bg-accent hover:bg-accent-muted text-white",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                isDeepAnalyzing && "animate-pulse"
              )}
            >
              {isDeepAnalyzing ? analysisProgress ?? "Analyzing…" : "Deep analyze"}
            </button>
          </div>
        )}
      </div>

      <InsightPanel commentary={commentary} isAnalyzing={isDeepAnalyzing} compact />
    </aside>
  );
}
