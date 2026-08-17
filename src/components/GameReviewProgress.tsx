"use client";

interface GameReviewProgressProps {
  progress: number;
  gameTitle: string;
  detail: string;
  elapsedMs?: number;
  onCancel?: () => void;
}

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  if (minutes > 0) return `${minutes}:${rem.toString().padStart(2, "0")}`;
  return `${seconds}s`;
}

export function GameReviewProgress({
  progress,
  gameTitle,
  detail,
  elapsedMs,
  onCancel,
}: GameReviewProgressProps) {
  const pct = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div
      className="sticky top-[57px] z-40 border-b border-board-border bg-board-panel/95 backdrop-blur-sm"
      data-testid="game-review-progress-bar"
      role="status"
      aria-live="polite"
    >
      <div className="max-w-[1400px] mx-auto px-3 py-2 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-white truncate">Analyzing: {gameTitle}</p>
          <p className="text-[10px] text-gray-500 truncate">{detail}</p>
        </div>
        {elapsedMs !== undefined && (
          <span className="text-xs tabular-nums text-gray-400 shrink-0" data-testid="review-elapsed">
            {formatElapsed(elapsedMs)}
          </span>
        )}
        <span className="text-xs tabular-nums text-accent shrink-0">{pct}%</span>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            data-testid="cancel-review-banner"
            className="text-xs text-gray-400 hover:text-white border border-board-border hover:border-gray-500 rounded-md px-2 py-1 shrink-0 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
      <div className="h-1 bg-board-border">
        <div
          className="h-full bg-accent transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}

export function formatReviewGameTitle(headers: Record<string, string>): string {
  const white = headers.White ?? "White";
  const black = headers.Black ?? "Black";
  const event = headers.Event?.trim();
  if (event && event !== "?") return `${white} vs ${black} (${event})`;
  return `${white} vs ${black}`;
}
