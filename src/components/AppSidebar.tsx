"use client";

import clsx from "clsx";
import type { ModelGame } from "@/lib/openings/modelGames";
import type { ChessComGame } from "@/types";
import { ImportGame } from "./ImportGame";

type SidebarTab = "import" | "masters";

interface AppSidebarProps {
  open: boolean;
  onClose: () => void;
  tab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onImportPgn: (pgn: string) => void;
  onSelectChessComGame: (game: ChessComGame) => void;
  onLoadDemo?: () => void;
  modelGames: ModelGame[];
  hasGame: boolean;
}

export function AppSidebar({
  open,
  onClose,
  tab,
  onTabChange,
  onImportPgn,
  onSelectChessComGame,
  onLoadDemo,
  modelGames,
  hasGame,
}: AppSidebarProps) {
  return (
    <>
      <div
        className={clsx(
          "fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px] transition-opacity duration-200",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={clsx(
          "fixed top-0 left-0 z-[70] h-full w-[min(100vw,26rem)] bg-board-panel border-r border-board-border shadow-2xl",
          "flex flex-col transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        data-testid="app-sidebar"
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-board-border shrink-0">
          <h2 className="text-sm font-semibold text-white">Menu</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-lg border border-board-border hover:bg-board-hover text-gray-400 hover:text-white transition-colors"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <div className="flex border-b border-board-border shrink-0">
          <SidebarTabButton active={tab === "import"} onClick={() => onTabChange("import")}>
            Import
          </SidebarTabButton>
          <SidebarTabButton
            active={tab === "masters"}
            onClick={() => onTabChange("masters")}
            disabled={!hasGame}
          >
            Masters
          </SidebarTabButton>
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === "import" && (
            <ImportGame
              variant="sidebar"
              onImportPgn={(pgn) => {
                onImportPgn(pgn);
                onClose();
              }}
              onSelectChessComGame={(game) => {
                onSelectChessComGame(game);
                onClose();
              }}
              onLoadDemo={() => {
                onLoadDemo?.();
                onClose();
              }}
            />
          )}

          {tab === "masters" && (
            <ModelGamesPanel modelGames={modelGames} />
          )}
        </div>
      </aside>
    </>
  );
}

function SidebarTabButton({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "flex-1 py-3 text-sm font-medium transition-colors touch-manipulation min-h-[44px]",
        disabled && "opacity-40 cursor-not-allowed",
        active
          ? "text-accent border-b-2 border-accent bg-board-hover/40"
          : "text-gray-500 hover:text-gray-200"
      )}
    >
      {children}
    </button>
  );
}

function ModelGamesPanel({ modelGames }: { modelGames: ModelGame[] }) {
  return (
    <div className="p-4 space-y-3" data-testid="model-games-panel">
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Learn from masters
        </h3>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          Annotated model games for the opening you are in.
        </p>
      </div>

      {modelGames.length === 0 ? (
        <p className="text-sm text-gray-500 py-4">
          Navigate into an opening line to see master games here.
        </p>
      ) : (
        modelGames.map((g) => (
          <a
            key={g.id}
            href={g.lichessUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block panel p-3 hover:bg-board-hover/40 transition-colors"
            data-testid="model-game-link"
          >
            <p className="text-sm text-white font-medium">
              {g.white} – {g.black}
            </p>
            <p className="text-xs text-gray-500">
              {g.event}, {g.year} · {g.result}
            </p>
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{g.lesson}</p>
          </a>
        ))
      )}
    </div>
  );
}
