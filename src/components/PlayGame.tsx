"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { Square } from "chess.js";
import { Chess } from "@/lib/chess";
import {
  buildMoveHintStyles,
  castlingRookMove,
  kingInCheckSquare,
  legalMovesFrom,
  pieceAt,
  pieceColor,
  sideToMove,
} from "@/lib/boardInteraction";
import { analyzeWithMultipleEngines, cancelLiveAnalysis, getCachedAnalysis } from "@/lib/engines/multiEngine";
import type { AnalysisMode } from "@/lib/engines/analysisModes";
import { generatePositionCommentary } from "@/lib/commentary/generator";
import { mergePositionCommentary } from "@/lib/commentary/coachEngineCompare";
import { prepareAnalysisForDisplay } from "@/lib/engines/normalizeAnalysis";
import { terminalPositionEval } from "@/lib/eval/positionEval";
import { resolveOpening } from "@/lib/openings/detectOpening";
import { fetchOpeningBook, type BookMove } from "@/lib/openingExplorer";
import type { GameMove, ImportedGame, MultiEngineAnalysis, PositionCommentary } from "@/types";
import { AnimatedChessboard, BOARD_BEST_FROM, BOARD_BEST_TO, BoardControls } from "./AnimatedChessboard";
import { EngineRail } from "./EngineRail";
import { BoardEvalBar } from "./BoardEvalBar";
import { BestMovesPanel } from "./BestMovesPanel";
import { MoveList } from "./MoveList";
import { PlayerBar } from "./PlayerBar";
import { buildLineArrowsFromMoves } from "@/lib/board/pvDisplay";

export function PlayGame() {
  const startingFen = useMemo(() => new Chess().fen(), []);
  const [history, setHistory] = useState<GameMove[]>([]);
  const [currentPly, setCurrentPly] = useState(0);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [reviewEnabled, setReviewEnabled] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("fast");
  const [liveConsensus, setLiveConsensus] = useState<MultiEngineAnalysis | null>(null);
  const [liveAnalysisFen, setLiveAnalysisFen] = useState<string | null>(null);
  const [liveAnalyzing, setLiveAnalyzing] = useState(false);
  const [deepConsensus, setDeepConsensus] = useState<MultiEngineAnalysis | null>(null);
  const [deepAnalysisFen, setDeepAnalysisFen] = useState<string | null>(null);
  const [deepCommentary, setDeepCommentary] = useState<PositionCommentary | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<string | null>(null);
  const [engineExpanded, setEngineExpanded] = useState(true);
  const [bookMoves, setBookMoves] = useState<BookMove[]>([]);
  const [bookLoading, setBookLoading] = useState(false);
  const [boardWidth, setBoardWidth] = useState(480);
  const [moveListExpanded, setMoveListExpanded] = useState(false);
  const analysisSeq = useRef(0);

  const currentFen = currentPly === 0 ? startingFen : history[currentPly - 1].fen;
  const turn = sideToMove(currentFen);
  const checkSquare = kingInCheckSquare(currentFen);

  const lastMove = useMemo(() => {
    if (currentPly === 0) return null;
    const move = history[currentPly - 1];
    return { from: move.uci.slice(0, 2) as Square, to: move.uci.slice(2, 4) as Square };
  }, [history, currentPly]);

  const castleRookMove = useMemo(() => {
    if (currentPly === 0) return null;
    const move = history[currentPly - 1];
    return move.isCastle ? castlingRookMove(move.san, move.color) : null;
  }, [history, currentPly]);

  const legalTargets = useMemo(
    () => (selectedSquare ? legalMovesFrom(currentFen, selectedSquare) : []),
    [currentFen, selectedSquare]
  );
  const moveHintStyles = useMemo(
    () => buildMoveHintStyles(selectedSquare, legalTargets),
    [selectedSquare, legalTargets]
  );

  // A lightweight ImportedGame shape so the existing commentary/opening/move-list machinery
  // (built for reviewing a finished game) works unchanged on a game still being played live.
  const game: ImportedGame = useMemo(
    () => ({ id: "play", pgn: "", headers: {}, moves: history, startingFen }),
    [history, startingFen]
  );

  const gameOpening = useMemo(() => {
    const prefix = history.slice(0, 12).map((m) => m.uci);
    return resolveOpening({}, prefix);
  }, [history]);

  const clearSelection = useCallback(() => setSelectedSquare(null), []);

  const applyMove = useCallback(
    (from: Square, to: Square, promotion?: "q" | "r" | "b" | "n") => {
      try {
        const chess = new Chess(currentFen);
        const move = chess.move({ from, to, promotion: promotion ?? "q" });
        if (!move) return false;
        const entry: GameMove = {
          san: move.san,
          uci: `${from}${to}${move.promotion ?? ""}`,
          fen: chess.fen(),
          ply: currentPly + 1,
          color: move.color as "w" | "b",
          captured: move.captured,
          isCheck: chess.inCheck(),
          isCastle: move.flags.includes("k") || move.flags.includes("q"),
          isPromotion: Boolean(move.promotion),
        };
        setHistory((prev) => [...prev.slice(0, currentPly), entry]);
        setCurrentPly((p) => p + 1);
        clearSelection();
        return true;
      } catch {
        return false;
      }
    },
    [currentFen, currentPly, clearSelection]
  );

  const goToPly = useCallback(
    (ply: number) => {
      setCurrentPly(Math.max(0, Math.min(ply, history.length)));
      clearSelection();
    },
    [history.length, clearSelection]
  );

  const onSquareClick = useCallback(
    (square: Square) => {
      if (selectedSquare === square) {
        clearSelection();
        return;
      }
      if (selectedSquare) {
        const match = legalTargets.find((m) => m.to === square);
        if (match) {
          applyMove(selectedSquare, square);
          return;
        }
      }
      const piece = pieceAt(currentFen, square);
      if (!piece) {
        clearSelection();
        return;
      }
      if (pieceColor(piece) !== turn) {
        clearSelection();
        return;
      }
      setSelectedSquare(square);
    },
    [selectedSquare, legalTargets, currentFen, turn, applyMove, clearSelection]
  );

  const onPieceDrop = useCallback(
    (source: Square, target: Square) => applyMove(source, target),
    [applyMove]
  );
  const onPromotionSelect = useCallback(
    (from: Square, to: Square, piece: "q" | "r" | "b" | "n") => applyMove(from, to, piece),
    [applyMove]
  );
  const canDragPiece = useCallback(
    (_square: Square, piece: string) => pieceColor(piece) === turn,
    [turn]
  );
  const onPieceDragBegin = useCallback(
    (square: Square) => {
      const piece = pieceAt(currentFen, square);
      if (piece && pieceColor(piece) === turn) setSelectedSquare(square);
    },
    [currentFen, turn]
  );
  const onPieceDragEnd = useCallback(() => clearSelection(), [clearSelection]);

  const newGame = useCallback(() => {
    setHistory([]);
    setCurrentPly(0);
    setSelectedSquare(null);
    setLiveConsensus(null);
    setDeepConsensus(null);
    setDeepCommentary(null);
    cancelLiveAnalysis();
  }, []);

  // Live evaluation only runs while review mode is on. Flipping it off cancels any in-flight
  // analysis and clears results immediately — no engine calls happen while it's off.
  useEffect(() => {
    if (!reviewEnabled) {
      cancelLiveAnalysis();
      setLiveConsensus(null);
      setLiveAnalysisFen(null);
      setDeepConsensus(null);
      setDeepAnalysisFen(null);
      setDeepCommentary(null);
      return;
    }

    const cached = getCachedAnalysis(currentFen, "fast");
    if (cached) {
      setLiveConsensus(cached);
      setLiveAnalysisFen(currentFen);
    }

    const seq = ++analysisSeq.current;
    const timer = setTimeout(async () => {
      setLiveAnalyzing(true);
      try {
        const result = await analyzeWithMultipleEngines(currentFen, undefined, {
          mode: "fast",
          scope: "live",
        });
        if (seq === analysisSeq.current) {
          setLiveConsensus(result);
          setLiveAnalysisFen(currentFen);
        }
      } catch {
        /* engine unavailable — leave eval blank rather than erroring the UI */
      } finally {
        if (seq === analysisSeq.current) setLiveAnalyzing(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [reviewEnabled, currentFen]);

  useEffect(() => {
    if (!reviewEnabled) {
      setBookMoves([]);
      return;
    }
    let cancelled = false;
    setBookLoading(true);
    fetchOpeningBook(currentFen)
      .then((moves) => {
        if (!cancelled) setBookMoves(moves);
      })
      .finally(() => {
        if (!cancelled) setBookLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reviewEnabled, currentFen]);

  const liveForPosition = useMemo(() => {
    if (!liveConsensus || liveAnalysisFen !== currentFen) return null;
    return prepareAnalysisForDisplay(currentFen, liveConsensus);
  }, [liveConsensus, liveAnalysisFen, currentFen]);

  const deepForPosition = useMemo(() => {
    if (!deepConsensus || deepAnalysisFen !== currentFen) return null;
    return prepareAnalysisForDisplay(currentFen, deepConsensus);
  }, [deepConsensus, deepAnalysisFen, currentFen]);

  const displayedAnalysis = reviewEnabled ? deepForPosition ?? liveForPosition : null;

  const whitePerspectiveEval = useMemo(() => {
    if (!reviewEnabled) return null;
    const terminal = terminalPositionEval(currentFen);
    if (terminal) return { eval: terminal.eval, mate: terminal.mate };
    if (!displayedAnalysis?.engines[0]) return null;
    return { eval: displayedAnalysis.engines[0].eval, mate: displayedAnalysis.engines[0].mate };
  }, [reviewEnabled, currentFen, displayedAnalysis]);

  const commentaryForPosition = useMemo((): PositionCommentary | null => {
    if (!reviewEnabled || !displayedAnalysis) return null;
    if (deepCommentary && deepAnalysisFen === currentFen) return deepCommentary;
    const ruleBased = generatePositionCommentary(game, currentPly, displayedAnalysis);
    return mergePositionCommentary(ruleBased, displayedAnalysis, null);
  }, [reviewEnabled, displayedAnalysis, deepCommentary, deepAnalysisFen, currentFen, game, currentPly]);

  const analyzePosition = useCallback(async () => {
    if (!reviewEnabled) return;
    setIsAnalyzing(true);
    setAnalysisProgress("Starting engine…");
    try {
      const result = await analyzeWithMultipleEngines(
        currentFen,
        (pass, total) => setAnalysisProgress(`Analyzing ${pass}/${total}…`),
        { mode: analysisMode, force: true, scope: "live" }
      );
      setDeepConsensus(result);
      setDeepAnalysisFen(currentFen);
      const ruleBased = generatePositionCommentary(game, currentPly, result);
      setDeepCommentary(mergePositionCommentary(ruleBased, result, null));
    } catch {
      /* leave existing state — a failed deep pass shouldn't wipe what's already shown */
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(null);
    }
  }, [reviewEnabled, currentFen, analysisMode, game, currentPly]);

  const engineHighlights = useMemo(() => {
    if (!reviewEnabled) return {};
    const uci = displayedAnalysis?.consensusMove;
    if (!uci || uci.length < 4) return {};
    return {
      [uci.slice(0, 2)]: { background: BOARD_BEST_FROM },
      [uci.slice(2, 4)]: { background: BOARD_BEST_TO },
    };
  }, [reviewEnabled, displayedAnalysis]);

  const bestMoveArrow = useMemo(() => {
    if (!reviewEnabled) return [];
    const anchorSide = sideToMove(currentFen);
    const moves = displayedAnalysis?.engines[0]?.bestMoves ?? [];
    if (moves.length > 1) return buildLineArrowsFromMoves(currentFen, moves, 3, 2, anchorSide);
    if (!displayedAnalysis?.consensusMove) return [];
    const from = displayedAnalysis.consensusMove.slice(0, 2) as Square;
    const to = displayedAnalysis.consensusMove.slice(2, 4) as Square;
    return [[from, to, "rgba(129, 182, 76, 0.9)"]] as [Square, Square, string][];
  }, [reviewEnabled, displayedAnalysis, currentFen]);

  const topPlayer = orientation === "white" ? "Black" : "White";
  const bottomPlayer = orientation === "white" ? "White" : "Black";
  const topActive = orientation === "white" ? turn === "b" : turn === "w";
  const bottomActive = orientation === "white" ? turn === "w" : turn === "b";

  return (
    <div className="min-h-screen bg-board-bg text-white">
      <header className="border-b border-board-border bg-board-panel/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center text-xl shadow-lg">
              ♟
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight">Play</h1>
              <p className="text-xs text-gray-500 hidden sm:block">Freeform board</p>
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

      <main className="max-w-[1400px] mx-auto px-3 py-3">
        <div
          className="flex flex-col lg:flex-row gap-3 items-start justify-center lg:max-h-[calc(100dvh-5rem)]"
          data-testid="play-layout"
        >
          {reviewEnabled && (
            <EngineRail
              evalScore={whitePerspectiveEval?.eval}
              mate={whitePerspectiveEval?.mate}
              analysisMode={analysisMode}
              onAnalysisModeChange={setAnalysisMode}
              onDeepAnalyze={analyzePosition}
              isDeepAnalyzing={isAnalyzing}
              analysisProgress={analysisProgress}
              engineExpanded={engineExpanded}
              onEngineExpandedChange={setEngineExpanded}
              commentary={commentaryForPosition}
              className="order-2 lg:order-1"
            />
          )}

          <div className="order-1 lg:order-2 flex-1 w-full min-w-0 max-w-[520px]">
            <div
              className="panel p-3 space-y-2 mb-3 flex items-center justify-between gap-3"
              data-testid="review-toggle-panel"
            >
              <div>
                <p className="text-sm font-semibold text-white">Review features</p>
                <p className="text-[11px] text-gray-500">
                  {reviewEnabled
                    ? "Live evaluation, engine lines and insight are on."
                    : "Plain board — legal moves only, no engine running."}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={reviewEnabled}
                data-testid="review-toggle"
                onClick={() => setReviewEnabled((v) => !v)}
                className={clsx(
                  "relative w-12 h-7 rounded-full transition-colors shrink-0 touch-manipulation",
                  reviewEnabled ? "bg-accent" : "bg-board-border"
                )}
              >
                <span
                  className={clsx(
                    "absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200",
                    reviewEnabled ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>

            <div className="flex flex-row items-stretch gap-0 w-full">
              {reviewEnabled && (
                <BoardEvalBar
                  evalScore={whitePerspectiveEval?.eval}
                  mate={whitePerspectiveEval?.mate}
                  orientation={orientation}
                  height={boardWidth}
                  isLoading={!whitePerspectiveEval && liveAnalyzing}
                  className="mr-1.5"
                />
              )}
              <div className="panel overflow-hidden shadow-2xl flex-1 min-w-0 transition-shadow duration-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
                <PlayerBar name={topPlayer} isActive={topActive} isTop />
                <div className="p-2 sm:p-3 bg-[#1a1816]">
                  <AnimatedChessboard
                    fen={currentFen}
                    orientation={orientation}
                    lastMove={lastMove}
                    castleRookMove={castleRookMove}
                    highlightSquares={engineHighlights}
                    moveHintStyles={moveHintStyles}
                    checkSquare={checkSquare}
                    engineArrows={bestMoveArrow}
                    interactive
                    onSquareClick={onSquareClick}
                    onPieceDrop={onPieceDrop}
                    onPieceDragBegin={onPieceDragBegin}
                    onPieceDragEnd={onPieceDragEnd}
                    onPromotionSelect={onPromotionSelect}
                    canDragPiece={canDragPiece}
                    onBoardWidthChange={setBoardWidth}
                  />
                </div>
                <PlayerBar name={bottomPlayer} isActive={bottomActive} />
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 mt-3">
              <button
                type="button"
                onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))}
                className="px-3 py-2 rounded-lg border border-board-border hover:bg-board-hover text-xs text-gray-300 transition-all touch-manipulation min-h-[40px]"
              >
                ⟳ Flip board
              </button>
              <button
                type="button"
                onClick={newGame}
                disabled={history.length === 0}
                data-testid="new-game-button"
                className="px-3 py-2 rounded-lg border border-board-border hover:bg-board-hover text-xs text-gray-300 transition-all touch-manipulation min-h-[40px] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ↺ New game
              </button>
            </div>

            <BoardControls
              onStart={() => goToPly(0)}
              onEnd={() => goToPly(history.length)}
              onPrev={() => goToPly(currentPly - 1)}
              onNext={() => goToPly(currentPly + 1)}
              canPrev={currentPly > 0}
              canNext={currentPly < history.length}
              currentPly={currentPly}
              totalPlies={history.length}
            />

            <div className="mt-3 w-full">
              <MoveList
                game={game}
                moves={history}
                currentPly={currentPly}
                onSelectPly={goToPly}
                expanded={moveListExpanded}
                onExpandedChange={setMoveListExpanded}
                variant="default"
              />
            </div>
          </div>

          {reviewEnabled && (
            <aside
              className="order-3 w-full lg:w-[15.5rem] lg:max-w-[15.5rem] shrink-0 flex flex-col gap-2 max-h-[calc(100dvh-5rem)] overflow-y-auto lg:sticky lg:top-14 lg:self-start scroll-mt-16"
              data-testid="play-right-sidebar"
            >
              <BestMovesPanel
                fen={currentFen}
                analysis={displayedAnalysis}
                bookMoves={bookMoves}
                bookLoading={bookLoading}
                opening={gameOpening}
              />
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
