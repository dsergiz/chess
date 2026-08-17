import clsx from "clsx";

interface PlayerBarProps {
  name: string;
  rating?: string;
  isActive?: boolean;
  isTop?: boolean;
  result?: string;
}

export function PlayerBar({ name, rating, isActive, isTop, result }: PlayerBarProps) {
  return (
    <div
      className={clsx(
        "flex items-center justify-between px-4 py-2.5 border transition-colors duration-200",
        isTop ? "rounded-b-none border-b-0" : "rounded-t-none",
        isActive
          ? "bg-board-hover/60 border-board-border"
          : "bg-board-panel border-board-border"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          <div
            className={clsx(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
              isActive ? "bg-board-border text-gray-200" : "bg-board-bg text-gray-500"
            )}
          >
            {name.charAt(0).toUpperCase()}
          </div>
          {isActive && (
            <span
              className="absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 rounded-full bg-accent/80 ring-2 ring-board-panel"
              aria-hidden
            />
          )}
        </div>
        <div className="min-w-0">
          <p className={clsx("truncate text-sm", isActive ? "text-gray-100" : "text-gray-400")}>
            {name}
          </p>
          {rating && <p className="text-xs text-gray-600">{rating}</p>}
        </div>
      </div>
      {result && (
        <span className="text-sm font-mono text-gray-500 shrink-0 ml-2">{result}</span>
      )}
    </div>
  );
}
