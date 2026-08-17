"use client";

import { motion } from "framer-motion";
import clsx from "clsx";
import type { MultiEngineAnalysis, PositionCommentary } from "@/types";
import { formatEval } from "@/lib/chess";
import type { AnalysisMode } from "@/lib/engines/analysisModes";
import { ANALYSIS_MODE_LABELS } from "@/lib/engines/analysisModes";

const MODES: AnalysisMode[] = ["fast", "deep", "tactical", "compare"];

interface AnalysisPanelProps {
  consensus: MultiEngineAnalysis | null;
  commentary: PositionCommentary | null;
  isAnalyzing: boolean;
  liveAnalyzing?: boolean;
  analysisProgress?: string | null;
  positionChanged?: boolean;
  modeNeedsRefresh?: boolean;
  analysisMode: AnalysisMode;
  onAnalysisModeChange: (mode: AnalysisMode) => void;
  onAnalyze: () => void;
  evalDisplay?: string;
}

export function AnalysisPanel({
  consensus,
  commentary,
  isAnalyzing,
  liveAnalyzing = false,
  analysisProgress,
  positionChanged,
  modeNeedsRefresh,
  analysisMode,
  onAnalysisModeChange,
  onAnalyze,
  evalDisplay,
}: AnalysisPanelProps) {
  const topEngine = consensus?.engines[0];
  const evalStr =
    evalDisplay ??
    (topEngine ? formatEval(topEngine.eval, topEngine.mate) : "—");

  const showCompare = analysisMode === "compare" && consensus && consensus.engines.length > 1;
  const showTacticalLines =
    consensus &&
    (analysisMode === "tactical" || (consensus.engines[0]?.bestMoves.length ?? 0) > 1);
  const engineBusy = isAnalyzing;

  return (
    <div className="panel p-4 flex flex-col gap-4" data-testid="analysis-panel">
      <div className="space-y-3">
        <label className="text-xs text-gray-500 uppercase tracking-wider font-medium">
          Engine mode
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="analysis-mode-select">
          {MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              disabled={engineBusy}
              onClick={() => onAnalysisModeChange(mode)}
              data-testid={`analysis-mode-${mode}`}
              className={clsx(
                "px-2 py-2 rounded-lg text-xs font-medium transition-all border touch-manipulation min-h-[40px]",
                analysisMode === mode
                  ? "bg-accent/15 border-accent/50 text-accent"
                  : "bg-board-bg border-board-border text-gray-400 hover:text-gray-200 hover:border-gray-500",
                engineBusy && "opacity-50 cursor-not-allowed"
              )}
            >
              {mode === "fast" ? "Fast" : mode === "deep" ? "Deep" : mode === "tactical" ? "Tactical" : "Compare"}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-600">{ANALYSIS_MODE_LABELS[analysisMode]}</p>
        {modeNeedsRefresh && !isAnalyzing && (
          <p className="text-xs text-amber-400/90" data-testid="mode-needs-refresh">
            Mode changed — click Deep analyze to refresh engine lines.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Evaluation</p>
          <p className="text-2xl font-bold text-white tabular-nums" data-testid="eval-display">
            {evalStr}
          </p>
          {positionChanged && !isAnalyzing && (
            <p className="text-xs text-amber-400/80 mt-0.5">Updating engine lines…</p>
          )}
        </div>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={engineBusy}
          data-testid="analyze-button"
          className={clsx(
            "px-5 py-2.5 rounded-lg font-semibold transition-all touch-manipulation min-h-[44px]",
            "bg-accent hover:bg-accent-muted text-white shadow-lg shadow-accent/20",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            isAnalyzing && "animate-pulse-glow"
          )}
        >
          {isAnalyzing ? (analysisProgress ?? "Analyzing…") : "Deep analyze"}
        </button>
      </div>

      {consensus && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-board-border bg-board-bg/80 p-4 space-y-3"
          data-testid="engine-consensus"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-accent-gold">
              {showCompare ? "Engine Consensus" : topEngine?.engineName ?? "Analysis"}
            </h3>
            {showCompare && (
              <span className="text-xs text-gray-400">
                {Math.round(consensus.agreement * 100)}% agreement
              </span>
            )}
          </div>

          {consensus.consensusSan && (
            <p className="text-white">
              Best move:{" "}
              <span className="font-mono text-accent-gold text-lg" data-testid="best-move">
                {consensus.consensusSan}
              </span>
            </p>
          )}

          {showCompare && (
            <div className="space-y-2">
              {consensus.engines.map((engine) => (
                <EngineRow
                  key={engine.engineId}
                  engine={engine}
                  isConsensus={engine.bestMoves[0]?.uci === consensus.consensusMove}
                />
              ))}
            </div>
          )}

          {showTacticalLines && !showCompare && consensus.engines[0]?.bestMoves.length > 1 && (
            <div className="space-y-2" data-testid="tactical-lines">
              {consensus.engines[0].bestMoves.map((move, i) => (
                <div
                  key={move.uci}
                  className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-board-panel/50"
                >
                  <span className="text-gray-500 tabular-nums w-4">{i + 1}</span>
                  <span className="font-mono text-white">{move.san}</span>
                  <span className="text-gray-400 tabular-nums">
                    {formatEval(move.score, move.mate)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {commentary && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-board-border bg-board-bg/80 p-4 space-y-3 animate-slide-up"
          data-testid="commentary-panel"
        >
          <h3 className="font-semibold text-accent-gold">AI Commentary</h3>
          <p className="text-gray-200 leading-relaxed">{commentary.summary}</p>

          {commentary.tacticalThemes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {commentary.tacticalThemes.map((theme) => (
                <span
                  key={theme}
                  className="text-xs px-2.5 py-1 rounded-full bg-board-border text-gray-300"
                >
                  {theme}
                </span>
              ))}
            </div>
          )}

          {commentary.bestLineExplanation && (
            <div className="border-t border-board-border pt-3">
              <p className="text-xs text-gray-400 mb-1">Why this move?</p>
              <p className="text-gray-200 text-sm leading-relaxed">{commentary.bestLineExplanation}</p>
            </div>
          )}

          <div className="border-t border-board-border pt-3">
            <p className="text-xs text-gray-400 mb-1">Path to this position</p>
            <p className="text-gray-300 text-sm font-mono leading-relaxed break-words" data-testid="path-to-position">
              {commentary.pathToPosition}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function EngineRow({
  engine,
  isConsensus,
}: {
  engine: MultiEngineAnalysis["engines"][0];
  isConsensus: boolean;
}) {
  const top = engine.bestMoves[0];
  return (
    <div
      className={clsx(
        "flex items-center justify-between text-sm px-3 py-2 rounded-lg",
        isConsensus ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-board-panel/50"
      )}
    >
      <span className="text-gray-400">{engine.engineName}</span>
      <div className="flex items-center gap-3">
        <span className="font-mono text-white">{top?.san ?? "—"}</span>
        <span className="text-gray-400 tabular-nums">
          {formatEval(engine.eval, engine.mate)}
        </span>
      </div>
    </div>
  );
}
