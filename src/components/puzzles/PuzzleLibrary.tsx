"use client";

import Link from "next/link";
import { useState } from "react";
import type { ExtractedGameCandidate, PdfExtractionResult } from "@/types/puzzle";
import type { ImportedGame } from "@/types";
import { parsePgn, pathToPly } from "@/lib/chess";
import { MoveList } from "@/components/MoveList";
import { PdfImportPanel } from "./PdfImportPanel";

type View = "import" | "confirm";

export function PuzzleLibrary() {
  const [view, setView] = useState<View>("import");
  const [pdfResult, setPdfResult] = useState<PdfExtractionResult | null>(null);
  const [confirmedGame, setConfirmedGame] = useState<ImportedGame | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [currentPly, setCurrentPly] = useState(0);
  const [expanded, setExpanded] = useState(true);

  const handleExtracted = (result: PdfExtractionResult) => {
    setPdfResult(result);
    setConfirmedGame(null);
    setConfirmError(null);
    setView("confirm");
  };

  const handleSelectCandidate = (candidate: ExtractedGameCandidate) => {
    setConfirmError(null);
    if (!candidate.game || candidate.game.moves.length === 0) {
      setConfirmError("This candidate has no legal moves to confirm.");
      setConfirmedGame(null);
      return;
    }
    try {
      const sanText = pathToPly(candidate.game, candidate.game.moves.length);
      const confirmed = parsePgn(sanText, candidate.id);
      setConfirmedGame(confirmed);
      setCurrentPly(confirmed.moves.length);
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Could not confirm this game");
      setConfirmedGame(null);
    }
  };

  return (
    <div className="min-h-screen bg-board-bg text-white">
      <header className="border-b border-board-border bg-board-panel/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center text-xl shadow-lg">
              📖
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight">Book Puzzles</h1>
              <p className="text-xs text-gray-500 hidden sm:block">Import games from book PDFs</p>
            </div>
          </div>
          <Link
            href="/"
            className="px-3 py-2 rounded-lg border border-board-border hover:bg-board-hover text-sm transition-all touch-manipulation min-h-[44px] flex items-center"
          >
            ← Game review
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <PdfImportPanel onExtracted={handleExtracted} />

        {pdfResult && (
          <div className="panel p-4 space-y-3" data-testid="candidate-list">
            <h2 className="font-semibold text-gray-200">
              {pdfResult.candidates.length} game{pdfResult.candidates.length === 1 ? "" : "s"} found in{" "}
              {pdfResult.fileName}
            </h2>
            <div className="space-y-2">
              {pdfResult.candidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => handleSelectCandidate(candidate)}
                  data-testid="candidate-item"
                  className="w-full text-left px-3 py-2.5 rounded-lg bg-board-bg hover:bg-board-hover border border-transparent hover:border-board-border transition-all touch-manipulation"
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-white font-medium text-sm leading-snug truncate">
                      {candidate.headerGuess ?? `Game (pages ${candidate.sourcePages.join("–")})`}
                    </span>
                    <span className="text-accent-gold font-mono text-xs shrink-0">
                      {candidate.game?.moves.length ?? 0} moves
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                    <span>Pages {candidate.sourcePages.join(", ")}</span>
                    {candidate.skippedTokens.length > 0 && (
                      <span className="text-yellow-400">
                        {candidate.skippedTokens.length} token{candidate.skippedTokens.length === 1 ? "" : "s"}{" "}
                        skipped
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {confirmError && (
          <p className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-lg" data-testid="confirm-error">
            {confirmError}
          </p>
        )}

        {confirmedGame && (
          <div className="space-y-4" data-testid="confirmed-game">
            <div className="panel p-4">
              <h2 className="font-semibold text-gray-200 mb-1">Confirmed game</h2>
              <p className="text-xs text-gray-500">
                Re-parsed through the same PGN parser used for Chess.com/paste imports — this is the
                game that would be scanned for puzzles in the next phase.
              </p>
            </div>
            <MoveList
              game={confirmedGame}
              moves={confirmedGame.moves}
              currentPly={currentPly}
              onSelectPly={setCurrentPly}
              expanded={expanded}
              onExpandedChange={setExpanded}
            />
          </div>
        )}
      </main>
    </div>
  );
}
