"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { Square } from "chess.js";
import { Chess, fenAtPly, parsePgn, classifyMove, uciToSan } from "@/lib/chess";
import {
  buildMoveHintStyles,
  castlingRookMove,
  kingInCheckSquare,
  legalMovesFrom,
  pieceAt,
  pieceColor,
  sideToMove,
  tryMove,
} from "@/lib/boardInteraction";
import { analyzeWithMultipleEngines, cancelLiveAnalysis, getCachedAnalysis, primeAnalysisCache } from "@/lib/engines/multiEngine";
import { loadCachedGameAnalysis, saveCachedGameAnalysis } from "@/lib/gameReview/analysisCacheDB";
import type { AnalysisMode } from "@/lib/engines/analysisModes";
import { generatePositionCommentary } from "@/lib/commentary/generator";
import type {
  ChessComGame,
  CoachAlignmentStats,
  ImportedGame,
  MoveClassification,
  MultiEngineAnalysis,
  PositionCommentary,
  ReviewTimingStats,
} from "@/types";
import { mergePositionCommentary } from "@/lib/commentary/coachEngineCompare";
import { AnimatedChessboard, BOARD_BEST_FROM, BOARD_BEST_TO, BoardControls } from "./AnimatedChessboard";
import { AppSidebar } from "./AppSidebar";
import { EngineRail } from "./EngineRail";
import { MoveList, CLASSIFICATION_STYLES } from "./MoveList";
import { BestMovesPanel } from "./BestMovesPanel";
import { GameReviewProgress, formatReviewGameTitle } from "./GameReviewProgress";
import { PlayerBar } from "./PlayerBar";
import { batchAnalyzeGame, cancelBatchReview, type BatchReviewProgress } from "@/lib/gameReview/batchAnalysis";
import { formatReviewDuration } from "@/lib/gameReview/reviewTiming";
import { fetchOpeningBook, fetchBookMoveSets, type BookMove } from "@/lib/openingExplorer";
import { resolveOpening, type DetectedOpening } from "@/lib/openings/detectOpening";
import { suggestModelGames } from "@/lib/openings/modelGames";
import { BoardEvalBar } from "./BoardEvalBar";
import { EvalGraph } from "./EvalGraph";
import {
  computeClassificationsFromCache,
  sideToMoveFromFen,
} from "@/lib/chess";
import { prepareAnalysisForDisplay } from "@/lib/engines/normalizeAnalysis";
import { DEMO_GAME_ID, DEMO_PGN } from "@/lib/demoGame";
import { terminalPositionEval } from "@/lib/eval/positionEval";
import {
  applyUciLine,
  buildLineArrowsFromMoves,
  pvToArrows,
} from "@/lib/board/pvDisplay";

/** Opening theory rarely runs deeper than this — bounds how many positions get a real book lookup. */
const BOOK_CLASSIFICATION_PLY_LIMIT = 24;

/** Real Lichess Masters book-move data for the game's opening plies, for move classification. */
async function fetchBookDataForGame(game: ImportedGame): Promise<Map<string, Set<string>>> {
  const cap = Math.min(game.moves.length, BOOK_CLASSIFICATION_PLY_LIMIT);
  const fens = Array.from({ length: cap }, (_, ply) => fenAtPly(game, ply));
  try {
    return await fetchBookMoveSets(fens);
  } catch {
    return new Map();
  }
}

export function GameReview() {
  const [game, setGame] = useState<ImportedGame | null>(null);
  const [currentPly, setCurrentPly] = useState(0);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [liveConsensus, setLiveConsensus] = useState<MultiEngineAnalysis | null>(null);
  const [liveAnalysisFen, setLiveAnalysisFen] = useState<string | null>(null);
  const [deepConsensus, setDeepConsensus] = useState<MultiEngineAnalysis | null>(null);
  const [deepAnalysisFen, setDeepAnalysisFen] = useState<string | null>(null);
  const [deepAnalysisMode, setDeepAnalysisMode] = useState<AnalysisMode>("fast");
  const [deepCommentary, setDeepCommentary] = useState<PositionCommentary | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [classifications, setClassifications] = useState<Map<number, MoveClassification>>(new Map());
  const [exploreFen, setExploreFen] = useState<string | null>(null);
  const [exploreMode, setExploreMode] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("fast");
  const [boardWidth, setBoardWidth] = useState(480);
  const [userArrows, setUserArrows] = useState<[Square, Square, string?][]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"import" | "masters">("import");
  const [moveListExpanded, setMoveListExpanded] = useState(false);
  const [expandedClassification, setExpandedClassification] = useState<MoveClassification | null>(
    null
  );
  const [engineExpanded, setEngineExpanded] = useState(true);
  const [liveAnalyzing, setLiveAnalyzing] = useState(false);
  const [bookMoves, setBookMoves] = useState<BookMove[]>([]);
  const [bookLoading, setBookLoading] = useState(false);
  const [batchReview, setBatchReview] = useState<BatchReviewProgress | null>(null);
  const [reviewElapsedMs, setReviewElapsedMs] = useState(0);
  const [reviewTimingStats, setReviewTimingStats] = useState<ReviewTimingStats | null>(null);
  const [coachAlignmentStats, setCoachAlignmentStats] = useState<CoachAlignmentStats>({
    compared: 0,
    aligned: 0,
    partial: 0,
    divergent: 0,
  });
  const [gameReviewCache, setGameReviewCache] = useState<Map<number, MultiEngineAnalysis> | null>(null);
  const [selectedLineUci, setSelectedLineUci] = useState<string | null>(null);
  const [linePreview, setLinePreview] = useState<{
    anchorFen: string;
    anchorPly: number;
    pv: string[];
    step: number;
  } | null>(null);
  const batchCancelRef = useRef(false);
  const batchRunIdRef = useRef(0);
  const gameReviewCacheRef = useRef<Map<number, MultiEngineAnalysis> | null>(null);
  gameReviewCacheRef.current = gameReviewCache;
  const analysisSeq = useRef(0);
  const liveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runAnalysisRef = useRef<
    ((options: {
      mode: AnalysisMode;
      force: boolean;
      withCommentary: boolean;
      live?: boolean;
    }) => Promise<void>) | null
  >(null);
  const fenRef = useRef("");
  const plyRef = useRef(0);
  const exploreRef = useRef(false);

  const linePreviewFen = useMemo(() => {
    if (!linePreview) return null;
    return applyUciLine(linePreview.anchorFen, linePreview.pv, linePreview.step);
  }, [linePreview]);

  const currentFen = useMemo(() => {
    if (linePreviewFen) return linePreviewFen;
    if (exploreFen) return exploreFen;
    return game ? fenAtPly(game, currentPly) : new Chess().fen();
  }, [game, currentPly, exploreFen, linePreviewFen]);

  fenRef.current = currentFen;
  plyRef.current = currentPly;
  exploreRef.current = exploreMode;

  const lastMove = useMemo(() => {
    if (!game || currentPly <= 0 || exploreMode) return null;
    const move = game.moves[currentPly - 1];
    return {
      from: move.uci.slice(0, 2) as Square,
      to: move.uci.slice(2, 4) as Square,
    };
  }, [game, currentPly, exploreMode]);

  const castleRookMove = useMemo(() => {
    if (!game || currentPly <= 0 || exploreMode) return null;
    const move = game.moves[currentPly - 1];
    return move.isCastle ? castlingRookMove(move.san, move.color) : null;
  }, [game, currentPly, exploreMode]);

  const turn = useMemo(() => sideToMove(currentFen), [currentFen]);
  const checkSquare = useMemo(() => kingInCheckSquare(currentFen), [currentFen]);

  const legalTargets = useMemo(() => {
    if (!selectedSquare) return [];
    return legalMovesFrom(currentFen, selectedSquare);
  }, [currentFen, selectedSquare]);

  const moveHintStyles = useMemo(
    () => buildMoveHintStyles(selectedSquare, legalTargets),
    [selectedSquare, legalTargets]
  );

  const liveForPosition = useMemo(() => {
    if (!liveConsensus || liveAnalysisFen !== currentFen) return null;
    return prepareAnalysisForDisplay(currentFen, liveConsensus);
  }, [liveConsensus, liveAnalysisFen, currentFen]);

  const deepForPosition = useMemo(() => {
    if (!deepConsensus || deepAnalysisFen !== currentFen) return null;
    return prepareAnalysisForDisplay(currentFen, deepConsensus);
  }, [deepConsensus, deepAnalysisFen, currentFen]);

  const cachedPositionAnalysis = useMemo(() => {
    if (!game || !gameReviewCache || exploreMode || linePreview || exploreFen) return null;
    const cached = gameReviewCache.get(currentPly);
    return cached ? prepareAnalysisForDisplay(currentFen, cached) : null;
  }, [game, gameReviewCache, currentPly, currentFen, exploreMode, linePreview, exploreFen]);

  const displayedAnalysis = deepForPosition ?? cachedPositionAnalysis ?? liveForPosition;
  const stockfishPositionCommentary = useMemo((): PositionCommentary | null => {
    if (!game || !cachedPositionAnalysis) return null;
    const ruleBased = generatePositionCommentary(game, currentPly, cachedPositionAnalysis);
    return mergePositionCommentary(ruleBased, cachedPositionAnalysis, null);
  }, [game, currentPly, cachedPositionAnalysis]);

  const commentaryForPosition =
    deepCommentary && deepAnalysisFen === currentFen ? deepCommentary : stockfishPositionCommentary;
  const modeNeedsRefresh =
    Boolean(deepForPosition) && deepAnalysisMode !== analysisMode;

  const uciMovesToPly = useMemo(() => {
    if (!game || currentPly <= 0) return [];
    return game.moves.slice(0, currentPly).map((m) => m.uci);
  }, [game, currentPly]);

  const gameOpening = useMemo((): DetectedOpening | null => {
    if (!game) return null;
    const prefix = game.moves.slice(0, 12).map((m) => m.uci);
    return resolveOpening(game.headers, prefix);
  }, [game]);

  const positionOpening = useMemo((): DetectedOpening | null => {
    if (!game || currentPly <= 0) return gameOpening;
    return resolveOpening(game.headers, uciMovesToPly) ?? gameOpening;
  }, [game, uciMovesToPly, gameOpening, currentPly]);

  const modelGames = useMemo(() => {
    if (!game) return [];
    return suggestModelGames(
      uciMovesToPly.length ? uciMovesToPly : game.moves.slice(0, 8).map((m) => m.uci),
      gameOpening?.eco
    );
  }, [uciMovesToPly, game, gameOpening?.eco]);

  const whitePerspectiveEval = useMemo(() => {
    const terminal = terminalPositionEval(currentFen);
    if (terminal) return { eval: terminal.eval, mate: terminal.mate };

    const source = cachedPositionAnalysis ?? deepForPosition ?? liveForPosition;
    if (!source?.engines[0]) return null;
    return { eval: source.engines[0].eval, mate: source.engines[0].mate };
  }, [cachedPositionAnalysis, deepForPosition, liveForPosition, currentFen]);

  const evalGraphData = useMemo(() => {
    if (!game || !gameReviewCache) return [];
    const plies = game.moves.length + 1;
    return Array.from({ length: plies }, (_, ply) => {
      const fen = fenAtPly(game, ply);
      const cached = gameReviewCache.get(ply);
      const prepared = cached ? prepareAnalysisForDisplay(fen, cached) : null;
      return prepared?.engines[0]?.eval ?? null;
    });
  }, [game, gameReviewCache]);

  const playedLine = useMemo(() => {
    if (!game || currentPly >= game.moves.length) return null;
    const upcoming = game.moves.slice(currentPly, currentPly + 4);
    if (upcoming.length === 0) return null;
    return { san: upcoming[0].san, pv: upcoming.map((m) => m.uci) };
  }, [game, currentPly]);

  const reviewSummary = useMemo(() => {
    if (!gameReviewCache || classifications.size === 0) return null;
    const counts = new Map<MoveClassification, number>();
    classifications.forEach((cls) => counts.set(cls, (counts.get(cls) ?? 0) + 1));
    return counts;
  }, [gameReviewCache, classifications]);

  const pliesByClassification = useMemo(() => {
    const map = new Map<MoveClassification, number[]>();
    classifications.forEach((cls, ply) => {
      const arr = map.get(cls);
      if (arr) arr.push(ply);
      else map.set(cls, [ply]);
    });
    map.forEach((arr) => arr.sort((a, b) => a - b));
    return map;
  }, [classifications]);

  const clearAnalysis = useCallback(() => {
    setLiveConsensus(null);
    setLiveAnalysisFen(null);
    setDeepConsensus(null);
    setDeepAnalysisFen(null);
    setDeepCommentary(null);
  }, []);

  const cancelPendingAnalysis = useCallback(() => {
    analysisSeq.current += 1;
    cancelLiveAnalysis();
  }, []);

  const applyAnalysisResult = useCallback(
    (
      result: MultiEngineAnalysis,
      fenSnapshot: string,
      plySnapshot: number,
      isVariation: boolean,
      options: { kind: "live" | "deep"; withCommentary?: boolean; mode?: AnalysisMode }
    ) => {
      if (options.kind === "live") {
        const sanitized = prepareAnalysisForDisplay(fenSnapshot, result);
        if (!sanitized) return;
        setLiveConsensus(sanitized);
        setLiveAnalysisFen(fenSnapshot);
        return;
      }

      const sanitized = prepareAnalysisForDisplay(fenSnapshot, result);
      if (!sanitized) return;

      setDeepConsensus(sanitized);
      setDeepAnalysisFen(fenSnapshot);
      setDeepAnalysisMode(options.mode ?? "fast");
      if (options.withCommentary && game) {
        const ruleCommentary = generatePositionCommentary(game, plySnapshot, sanitized, {
          isVariation,
        });
        setDeepCommentary(ruleCommentary);
        void fetch("/api/commentary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            game,
            ply: plySnapshot,
            consensus: sanitized,
            isVariation,
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.commentary && fenRef.current === fenSnapshot) {
              setDeepCommentary(data.commentary);
              if (data.alignment?.coachLine) {
                const agreement = data.alignment.agreement as "aligned" | "partial" | "divergent";
                setCoachAlignmentStats((prev) => ({
                  compared: prev.compared + 1,
                  aligned: prev.aligned + (agreement === "aligned" ? 1 : 0),
                  partial: prev.partial + (agreement === "partial" ? 1 : 0),
                  divergent: prev.divergent + (agreement === "divergent" ? 1 : 0),
                }));
              }
            }
          })
          .catch(() => {});
      }

      if (!isVariation && plySnapshot > 0 && game?.moves[plySnapshot - 1]) {
        const beforeCache = gameReviewCacheRef.current?.get(plySnapshot - 1);
        const beforeEngine = beforeCache?.engines[0];
        const afterEngine = sanitized.engines[0];
        if (beforeEngine && afterEngine) {
          const mover = game.moves[plySnapshot - 1].color;
          const swing =
            mover === "w"
              ? beforeEngine.eval - afterEngine.eval
              : afterEngine.eval - beforeEngine.eval;
          setClassifications((prev) => {
            const next = new Map(prev);
            next.set(plySnapshot, classifyMove(Math.max(0, swing / 100)));
            return next;
          });
        }
      }
    },
    [game]
  );

  const clearSelection = useCallback(() => setSelectedSquare(null), []);

  useEffect(() => {
    clearSelection();
  }, [currentFen, clearSelection]);

  const invalidateAnalysis = useCallback(() => {
    cancelPendingAnalysis();
    clearAnalysis();
  }, [cancelPendingAnalysis, clearAnalysis]);

  const loadGame = useCallback(
    (pgn: string, sourceId?: string) => {
      try {
        const imported = parsePgn(pgn, sourceId);
        batchRunIdRef.current += 1;
        batchCancelRef.current = true;
        cancelBatchReview();
        setGame(imported);
        setCurrentPly(0);
        setExploreFen(null);
        setExploreMode(false);
        invalidateAnalysis();
        setImportError(null);
        setOrientation("white");
        setMoveListExpanded(false);
        setSelectedLineUci(null);
        setLinePreview(null);
        setGameReviewCache(null);
        setReviewTimingStats(null);
        setReviewElapsedMs(0);
        setBatchReview(null);
        setCoachAlignmentStats({ compared: 0, aligned: 0, partial: 0, divergent: 0 });
        setClassifications(new Map());
        clearSelection();
      } catch (err) {
        setImportError(err instanceof Error ? err.message : "Failed to load game");
      }
    },
    [invalidateAnalysis, clearSelection]
  );

  const loadDemoGame = useCallback(() => {
    loadGame(DEMO_PGN, DEMO_GAME_ID);
  }, [loadGame]);

  // Cheap, automatic: hydrate from a previous review already sitting in IndexedDB.
  // Never runs Stockfish — that only happens when the user explicitly starts a review.
  useEffect(() => {
    if (!game) return;
    let active = true;

    void (async () => {
      const persisted = await loadCachedGameAnalysis(game.id);
      if (!active || !persisted || persisted.length === 0) return;

      primeAnalysisCache(persisted.map((e) => ({ fen: e.fen, mode: e.mode, analysis: e.analysis })));

      const byFen = new Map(
        persisted.filter((e) => e.mode === "review").map((e) => [e.fen, e.analysis])
      );
      const total = game.moves.length + 1;
      const sanitizedCache = new Map<number, MultiEngineAnalysis>();
      for (let ply = 0; ply < total; ply++) {
        const analysis = byFen.get(fenAtPly(game, ply));
        if (analysis) sanitizedCache.set(ply, analysis);
      }

      if (!active || sanitizedCache.size !== total) return;
      setGameReviewCache(sanitizedCache);
      setClassifications(computeClassificationsFromCache(game, sanitizedCache, true));
      const bookData = await fetchBookDataForGame(game);
      if (active) {
        setClassifications(computeClassificationsFromCache(game, sanitizedCache, true, bookData));
      }
    })();

    return () => {
      active = false;
    };
  }, [game?.id]);

  const runFullReview = useCallback(() => {
    if (!game || batchReview) return;
    const targetGame = game;
    const runId = ++batchRunIdRef.current;
    batchCancelRef.current = false;
    cancelPendingAnalysis();

    const gameTitle = formatReviewGameTitle(targetGame.headers);
    const total = targetGame.moves.length + 1;
    setReviewElapsedMs(0);
    setBatchReview({ percent: 0, done: 0, total, gameTitle });

    void (async () => {
      const { cache, stats } = await batchAnalyzeGame(
        targetGame,
        (done, count, elapsedMs) => {
          if (runId !== batchRunIdRef.current) return;
          setReviewElapsedMs(elapsedMs);
          setBatchReview({ percent: Math.round((done / count) * 100), done, total: count, gameTitle });
        },
        () => batchCancelRef.current || runId !== batchRunIdRef.current
      );

      if (batchCancelRef.current || runId !== batchRunIdRef.current) return;

      const sanitizedCache = new Map<number, MultiEngineAnalysis>();
      cache.forEach((analysis, ply) => {
        const fen = fenAtPly(targetGame, ply);
        const prepared = prepareAnalysisForDisplay(fen, analysis);
        if (prepared) sanitizedCache.set(ply, prepared);
      });

      if (sanitizedCache.size === total) {
        void saveCachedGameAnalysis(
          targetGame.id,
          Array.from(sanitizedCache.entries()).map(([ply, analysis]) => ({
            fen: fenAtPly(targetGame, ply),
            mode: "review" as const,
            analysis,
          }))
        );
      }

      setGameReviewCache(sanitizedCache);
      setReviewTimingStats(stats);
      setBatchReview(null);
      setReviewElapsedMs(0);
      setClassifications(computeClassificationsFromCache(targetGame, sanitizedCache, true));
      const bookData = await fetchBookDataForGame(targetGame);
      if (runId === batchRunIdRef.current) {
        setClassifications(computeClassificationsFromCache(targetGame, sanitizedCache, true, bookData));
      }
    })();
  }, [game, batchReview, cancelPendingAnalysis]);

  const cancelFullReview = useCallback(() => {
    batchRunIdRef.current += 1;
    batchCancelRef.current = true;
    cancelBatchReview();
    setBatchReview(null);
    setReviewElapsedMs(0);
  }, []);

  useEffect(() => {
    return () => {
      batchCancelRef.current = true;
      cancelBatchReview();
    };
  }, []);

  const handleChessComGame = useCallback(
    (chessGame: ChessComGame) => {
      if (!chessGame.pgn) {
        setImportError("This game has no PGN data");
        return;
      }
      loadGame(chessGame.pgn, chessGame.uuid);
    },
    [loadGame]
  );

  const goToPly = useCallback(
    (ply: number, opts?: { collapseMoveList?: boolean }) => {
      if (!game) return;
      setExploreFen(null);
      setExploreMode(false);
      setLinePreview(null);
      setSelectedLineUci(null);
      setCurrentPly(Math.max(0, Math.min(ply, game.moves.length)));
      setDeepCommentary(null);
      cancelPendingAnalysis();
      clearSelection();
      // Sequential-style navigation (arrow keys, Prev/Next buttons) re-minimizes the move
      // list; jumping to a specific move from the expanded list or a classification lookup
      // leaves it as-is so the user can keep browsing what they opened it for.
      if (opts?.collapseMoveList ?? true) setMoveListExpanded(false);
    },
    [game, cancelPendingAnalysis, clearSelection]
  );

  const startLinePreview = useCallback(
    (pv: string[]) => {
      if (!game || pv.length === 0) return;
      setLinePreview({ anchorFen: currentFen, anchorPly: currentPly, pv, step: 1 });
      setExploreMode(true);
      setExploreFen(null);
      setSelectedLineUci(pv[0] ?? null);
      setDeepCommentary(null);
      cancelPendingAnalysis();
    },
    [game, currentFen, currentPly, cancelPendingAnalysis]
  );

  const stepLinePreview = useCallback((delta: number) => {
    setLinePreview((prev) => {
      if (!prev) return prev;
      const next = Math.max(0, Math.min(prev.pv.length, prev.step + delta));
      return { ...prev, step: next };
    });
  }, []);

  const goToPreviewStep = useCallback((step: number) => {
    setLinePreview((prev) =>
      prev ? { ...prev, step: Math.max(0, Math.min(prev.pv.length, step)) } : prev
    );
  }, []);

  const previewSanMoves = useMemo(() => {
    if (!linePreview) return [];
    const sans: string[] = [];
    let position = linePreview.anchorFen;
    for (const uci of linePreview.pv) {
      try {
        sans.push(uciToSan(position, uci));
        const chess = new Chess(position);
        chess.move({
          from: uci.slice(0, 2) as Square,
          to: uci.slice(2, 4) as Square,
          promotion: uci.length > 4 ? (uci[4] as "q" | "r" | "b" | "n") : undefined,
        });
        position = chess.fen();
      } catch {
        break;
      }
    }
    return sans;
  }, [linePreview]);

  const applyMove = useCallback(
    (from: Square, to: Square, promotion?: "q" | "r" | "b" | "n") => {
      const result = tryMove(currentFen, from, to, promotion);
      if (!result.ok) return false;
      setExploreFen(result.fen);
      setExploreMode(true);
      setLinePreview(null);
      setSelectedLineUci(null);
      setDeepCommentary(null);
      cancelPendingAnalysis();
      clearSelection();
      return true;
    },
    [currentFen, cancelPendingAnalysis, clearSelection]
  );

  const runAnalysis = useCallback(
    async (options: { mode: AnalysisMode; force: boolean; withCommentary: boolean; live?: boolean }) => {
      if (!game) return;

      cancelLiveAnalysis();
      const seq = ++analysisSeq.current;
      const fenSnapshot = fenRef.current;
      const plySnapshot = plyRef.current;
      const isVariation = exploreRef.current;
      const { mode, force, withCommentary, live = false } = options;

      if (!live && liveTimerRef.current) {
        clearTimeout(liveTimerRef.current);
        liveTimerRef.current = null;
      }

      if (!force) {
        const cached = getCachedAnalysis(fenSnapshot, mode);
        if (cached) {
          applyAnalysisResult(cached, fenSnapshot, plySnapshot, isVariation, {
            kind: live ? "live" : "deep",
            withCommentary,
            mode,
          });
          if (!live && withCommentary) {
            setIsAnalyzing(false);
            setAnalysisProgress(null);
          }
          if (live) setLiveAnalyzing(false);
          return;
        }
      }

      if (live) {
        setLiveAnalyzing(true);
      } else {
        setIsAnalyzing(true);
        setAnalysisProgress("Starting engine…");
      }

      const timeoutMs =
        mode === "fast"
          ? 8000
          : mode === "deep"
            ? 20000
            : mode === "compare"
              ? 25000
              : 15000;

      try {
        let result: MultiEngineAnalysis;

        const apiFallback = async () => {
          const res = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fen: fenSnapshot, mode }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          return data.consensus as MultiEngineAnalysis;
        };

        if (typeof Worker === "undefined") {
          result = await apiFallback();
        } else {
          try {
            result = await Promise.race([
              analyzeWithMultipleEngines(
                fenSnapshot,
                (pass, total) => {
                  if (!live) setAnalysisProgress(`Analyzing ${pass}/${total}…`);
                },
                { force, mode, scope: "live" }
              ),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("Engine timeout")), timeoutMs)
              ),
            ]);
          } catch {
            if (!live) setAnalysisProgress("Using quick analysis…");
            result = await apiFallback();
          }
        }

        if (seq !== analysisSeq.current) return;
        if (fenRef.current !== fenSnapshot) return;

        applyAnalysisResult(result, fenSnapshot, plySnapshot, isVariation, {
          kind: live ? "live" : "deep",
          withCommentary,
          mode,
        });
      } catch (err) {
        if (seq !== analysisSeq.current) return;
        if (err instanceof Error && err.message === "Analysis cancelled") return;
        if (!live) {
          console.error("Analysis failed:", err);
          setImportError(err instanceof Error ? err.message : "Analysis failed");
        }
      } finally {
        if (seq === analysisSeq.current) {
          if (live) {
            setLiveAnalyzing(false);
          } else {
            setIsAnalyzing(false);
            setAnalysisProgress(null);
          }
        }
      }
    },
    [game, applyAnalysisResult]
  );

  runAnalysisRef.current = runAnalysis;

  const analyzePosition = useCallback(() => {
    runAnalysis({
      mode: analysisMode,
      force: true,
      withCommentary: true,
      live: false,
    });
  }, [analysisMode, runAnalysis]);

  useEffect(() => {
    if (!game) return;

    if (!exploreMode && !linePreview && !exploreFen) {
      const batchCached = gameReviewCache?.get(currentPly);
      if (batchCached) {
        applyAnalysisResult(batchCached, currentFen, currentPly, false, { kind: "live" });
        return;
      }
      // No full-game review yet — fall through and analyze this position live, on demand.
    }

    const cached = getCachedAnalysis(currentFen, "fast");
    if (cached) {
      applyAnalysisResult(cached, currentFen, plyRef.current, exploreRef.current, {
        kind: "live",
      });
    }

    const timer = setTimeout(() => {
      runAnalysisRef.current?.({
        mode: "fast",
        force: false,
        withCommentary: false,
        live: true,
      });
    }, 200);
    liveTimerRef.current = timer;

    return () => {
      clearTimeout(timer);
      if (liveTimerRef.current === timer) liveTimerRef.current = null;
    };
  }, [currentFen, game?.id, currentPly, exploreMode, exploreFen, linePreview, gameReviewCache, applyAnalysisResult]);

  useEffect(() => {
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
  }, [currentFen]);

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

  const onPieceDragBegin = useCallback(
    (square: Square) => {
      const piece = pieceAt(currentFen, square);
      if (piece && pieceColor(piece) === turn) setSelectedSquare(square);
    },
    [currentFen, turn]
  );

  const onPieceDragEnd = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

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

  const activeLineMove = useMemo(() => {
    const moves = displayedAnalysis?.engines[0]?.bestMoves ?? [];
    if (selectedLineUci) return moves.find((m) => m.uci === selectedLineUci) ?? moves[0];
    return moves[0];
  }, [displayedAnalysis, selectedLineUci]);

  const engineHighlights = useMemo(() => {
    const uci =
      linePreview && linePreview.step > 0
        ? linePreview.pv[linePreview.step - 1]
        : activeLineMove?.uci ?? displayedAnalysis?.consensusMove;
    if (!uci || uci.length < 4) return {};
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    return {
      [from]: { background: BOARD_BEST_FROM },
      [to]: { background: BOARD_BEST_TO },
    };
  }, [displayedAnalysis, activeLineMove, linePreview]);

  const bestMoveArrow = useMemo(() => {
    if (linePreview) {
      const played = linePreview.pv.slice(0, linePreview.step);
      if (played.length === 0) return [];
      return pvToArrows(linePreview.anchorFen, played, played.length);
    }
    const anchorFen = game ? fenAtPly(game, currentPly) : currentFen;
    const anchorSide = sideToMove(anchorFen);
    if (activeLineMove?.pv?.length) {
      return pvToArrows(anchorFen, activeLineMove.pv, 2, anchorSide);
    }
    const moves = displayedAnalysis?.engines[0]?.bestMoves ?? [];
    if (moves.length > 1) {
      return buildLineArrowsFromMoves(anchorFen, moves, 3, 2, anchorSide);
    }
    if (!displayedAnalysis?.consensusMove) return [];
    const from = displayedAnalysis.consensusMove.slice(0, 2) as Square;
    const to = displayedAnalysis.consensusMove.slice(2, 4) as Square;
    return [[from, to, "rgba(129, 182, 76, 0.9)"]] as [Square, Square, string][];
  }, [displayedAnalysis, activeLineMove, linePreview, game, currentPly, currentFen]);

  useEffect(() => {
    setUserArrows([]);
  }, [currentPly, exploreFen, orientation]);

  useEffect(() => {
    if (!game) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Escape") {
        if (linePreview) {
          goToPly(currentPly);
        } else {
          setUserArrows([]);
        }
        return;
      }
      // While previewing a line (engine suggestion or the actually-played continuation),
      // arrow/Home/End step through that preview instead of abandoning it and jumping
      // the mainline game — previously these always called goToPly(), which silently
      // exited the preview and could walk it back to the game's starting position.
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (linePreview) stepLinePreview(-1);
        else goToPly(currentPly - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (linePreview) stepLinePreview(1);
        else goToPly(currentPly + 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        if (linePreview) stepLinePreview(-linePreview.step);
        else goToPly(0);
      } else if (e.key === "End") {
        e.preventDefault();
        if (linePreview) stepLinePreview(linePreview.pv.length - linePreview.step);
        else goToPly(game.moves.length);
      } else if (e.key === "f" || e.key === "F") {
        if (!e.ctrlKey && !e.metaKey) setOrientation((o) => (o === "white" ? "black" : "white"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game, currentPly, goToPly, linePreview, stepLinePreview]);

  const headers = game?.headers ?? {};
  const whiteName = headers.White ?? "White";
  const blackName = headers.Black ?? "Black";
  const whiteElo = headers.WhiteElo ? `${headers.WhiteElo} Elo` : undefined;
  const blackElo = headers.BlackElo ? `${headers.BlackElo} Elo` : undefined;

  const topPlayer = orientation === "white" ? blackName : whiteName;
  const bottomPlayer = orientation === "white" ? whiteName : blackName;
  const topElo = orientation === "white" ? blackElo : whiteElo;
  const bottomElo = orientation === "white" ? whiteElo : blackElo;
  const topActive = orientation === "white" ? turn === "b" : turn === "w";
  const bottomActive = orientation === "white" ? turn === "w" : turn === "b";

  return (
    <div className="min-h-screen bg-board-bg text-white">
      <header className="border-b border-board-border bg-board-panel/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              data-testid="app-menu-button"
              className="h-10 w-10 rounded-lg border border-board-border hover:bg-board-hover text-gray-300 transition-colors shrink-0"
              aria-label="Open menu"
              title="Menu — import & master games"
            >
              ☰
            </button>
            <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center text-xl shadow-lg">
              ♞
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight">Chess Eval</h1>
              <p className="text-xs text-gray-500 hidden sm:block">AI game review</p>
            </div>
            <Link
              href="/play"
              className="ml-1 px-3 py-2 rounded-lg border border-board-border hover:bg-board-hover text-sm text-gray-300 transition-all touch-manipulation min-h-[44px] hidden sm:flex items-center"
            >
              ♟ Play
            </Link>
            <Link
              href="/puzzles"
              className="px-3 py-2 rounded-lg border border-board-border hover:bg-board-hover text-sm text-gray-300 transition-all touch-manipulation min-h-[44px] hidden sm:flex items-center"
            >
              📖 Puzzles
            </Link>
          </div>
          {game && (
            <div className="flex items-center gap-2 min-w-0 flex-wrap justify-end">
              {reviewTimingStats && (
                <span
                  className="hidden lg:inline text-[11px] text-gray-500 tabular-nums shrink-0"
                  data-testid="review-timing-stats"
                  title="Stockfish full-game review time"
                >
                  Review {formatReviewDuration(reviewTimingStats.totalMs)}
                  {reviewTimingStats.avgMsPerPosition > 0 &&
                    ` · ${reviewTimingStats.avgMsPerPosition}ms/pos`}
                </span>
              )}
              {coachAlignmentStats.compared > 0 && (
                <span
                  className="hidden md:inline text-[11px] text-gray-500 shrink-0"
                  data-testid="coach-alignment-stats"
                  title="Coach vs Stockfish agreement (deep analyze positions)"
                >
                  Coach {coachAlignmentStats.aligned}/{coachAlignmentStats.compared} aligned
                  {coachAlignmentStats.divergent > 0 &&
                    ` · ${coachAlignmentStats.divergent} differ`}
                </span>
              )}
              <span
                className="hidden md:inline text-xs text-gray-400 truncate max-w-[220px]"
                data-testid="game-title"
              >
                {formatReviewGameTitle(headers)}
              </span>
              <span className="hidden sm:inline text-xs text-gray-500 font-mono shrink-0">
                {headers.Result ?? "*"}
              </span>
              <button
                type="button"
                onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))}
                className="px-3 py-2 rounded-lg border border-board-border hover:bg-board-hover text-sm transition-all touch-manipulation min-h-[44px]"
                aria-label="Flip board"
                title="Flip board (F)"
              >
                ⟳ Flip
              </button>
            </div>
          )}
        </div>
      </header>

      <AppSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        tab={sidebarTab}
        onTabChange={setSidebarTab}
        onImportPgn={loadGame}
        onSelectChessComGame={handleChessComGame}
        onLoadDemo={loadDemoGame}
        modelGames={modelGames}
        hasGame={!!game}
      />

      {importError && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="panel px-4 py-3 text-red-300 text-sm flex justify-between items-center">
            <span>{importError}</span>
            <button type="button" onClick={() => setImportError(null)} className="text-gray-400 hover:text-white ml-4">
              ✕
            </button>
          </div>
        </div>
      )}

      <main className="max-w-[1400px] mx-auto px-3 py-3">
        {!game ? (
          <div className="max-w-md mx-auto pt-16 text-center px-4">
            <h2 className="text-2xl font-bold mb-2">Review your games</h2>
            <p className="text-gray-400 mb-8 text-sm leading-relaxed">
              Step through any game with live Stockfish evaluation. Open the menu to import a PGN or
              Chess.com game.
            </p>
            <button
              type="button"
              onClick={() => {
                setSidebarTab("import");
                setSidebarOpen(true);
              }}
              data-testid="open-menu-empty"
              className="px-6 py-3 rounded-lg bg-accent hover:bg-accent-muted text-white font-semibold transition-all min-h-[44px]"
            >
              Open menu to import
            </button>
          </div>
        ) : (
          <>
            {batchReview && (
              <GameReviewProgress
                progress={batchReview.percent}
                gameTitle={batchReview.gameTitle}
                detail={`Stockfish · position ${batchReview.done} of ${batchReview.total}`}
                elapsedMs={reviewElapsedMs}
                onCancel={cancelFullReview}
              />
            )}
            <div
              className="flex flex-col lg:flex-row gap-3 items-start justify-center lg:max-h-[calc(100dvh-5rem)]"
              data-testid="review-layout"
            >
              <div className="order-2 lg:order-1 flex flex-col gap-2 w-full lg:w-[19rem] lg:min-w-[19rem] shrink-0">
                <div className="panel p-3 space-y-2" data-testid="full-review-panel">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Full Game Review
                  </h3>
                  {batchReview ? (
                    <div className="space-y-1.5">
                      <p className="text-xs text-gray-400">
                        Stockfish · position {batchReview.done} of {batchReview.total}
                      </p>
                      <div className="h-1 rounded-full overflow-hidden bg-board-border">
                        <div
                          className="h-full bg-accent transition-all duration-300 ease-out"
                          style={{ width: `${batchReview.percent}%` }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={cancelFullReview}
                        className="text-[11px] text-gray-500 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : gameReviewCache ? (
                    <div className="space-y-2" data-testid="review-summary">
                      <p className="text-xs text-emerald-400">✓ Every move classified</p>
                      {reviewSummary && (
                        <div className="grid grid-cols-2 gap-1">
                          {(Object.keys(CLASSIFICATION_STYLES) as MoveClassification[])
                            .filter((cls) => (reviewSummary.get(cls) ?? 0) > 0)
                            .map((cls) => {
                              const style = CLASSIFICATION_STYLES[cls];
                              const isOpen = expandedClassification === cls;
                              return (
                                <button
                                  key={cls}
                                  type="button"
                                  onClick={() =>
                                    setExpandedClassification((prev) => (prev === cls ? null : cls))
                                  }
                                  title={`Show ${style.label} moves`}
                                  aria-expanded={isOpen}
                                  data-testid={`summary-${cls}`}
                                  className={clsx(
                                    "flex items-center justify-between rounded px-1.5 py-1 text-xs hover:brightness-110 active:scale-95 transition-all touch-manipulation",
                                    style.bg,
                                    isOpen && "ring-1 ring-white/40"
                                  )}
                                >
                                  <span className={clsx("font-medium", style.text)}>
                                    {style.label}
                                  </span>
                                  <span className="tabular-nums text-gray-300">
                                    {reviewSummary.get(cls)}
                                  </span>
                                </button>
                              );
                            })}
                        </div>
                      )}
                      {expandedClassification && (
                        <div
                          className="space-y-0.5 pt-1 border-t border-board-border"
                          data-testid="classification-move-list"
                        >
                          {(pliesByClassification.get(expandedClassification) ?? []).map((ply) => {
                            const move = game?.moves[ply - 1];
                            if (!move) return null;
                            const label =
                              ply % 2 === 1
                                ? `${Math.ceil(ply / 2)}. ${move.san}`
                                : `${Math.ceil(ply / 2)}… ${move.san}`;
                            return (
                              <button
                                key={ply}
                                type="button"
                                onClick={() => goToPly(ply, { collapseMoveList: false })}
                                className={clsx(
                                  "w-full flex items-center justify-between rounded px-1.5 py-1 text-xs font-mono transition-colors touch-manipulation",
                                  ply === currentPly
                                    ? "bg-accent/15 text-white"
                                    : "text-gray-400 hover:bg-board-hover hover:text-white"
                                )}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500">
                        Classify every move (brilliant, blunder, etc.) with a full Stockfish pass.
                      </p>
                      <button
                        type="button"
                        onClick={runFullReview}
                        data-testid="run-full-review"
                        className="w-full py-2 rounded-lg bg-accent hover:bg-accent-muted text-white text-sm font-semibold transition-all min-h-[36px] touch-manipulation"
                      >
                        Run full review
                      </button>
                    </>
                  )}
                </div>

                <EngineRail
                  evalScore={whitePerspectiveEval?.eval}
                  mate={whitePerspectiveEval?.mate}
                  analysisMode={analysisMode}
                  onAnalysisModeChange={setAnalysisMode}
                  onDeepAnalyze={analyzePosition}
                  isDeepAnalyzing={isAnalyzing}
                  analysisProgress={analysisProgress}
                  modeNeedsRefresh={modeNeedsRefresh}
                  engineExpanded={engineExpanded}
                  onEngineExpandedChange={setEngineExpanded}
                  commentary={commentaryForPosition}
                />
              </div>

              <div className="order-1 lg:order-2 flex-1 w-full min-w-0 max-w-[520px]">
                <div className="flex flex-row items-stretch gap-0 w-full">
                  <BoardEvalBar
                    evalScore={whitePerspectiveEval?.eval}
                    mate={whitePerspectiveEval?.mate}
                    orientation={orientation}
                    height={boardWidth}
                    isLoading={!whitePerspectiveEval && liveAnalyzing}
                    className="mr-1.5"
                  />
                  <div className="panel overflow-hidden shadow-2xl flex-1 min-w-0 transition-shadow duration-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
                    <PlayerBar name={topPlayer} rating={topElo} isActive={topActive} isTop />
                    <div className="p-2 sm:p-3 bg-[#1a1816]">
                      <AnimatedChessboard
                        boardKey={`${game.id}-${exploreMode ? "var" : "main"}`}
                        fen={currentFen}
                        orientation={orientation}
                        lastMove={lastMove}
                        castleRookMove={castleRookMove}
                        highlightSquares={engineHighlights}
                        moveHintStyles={moveHintStyles}
                        checkSquare={checkSquare}
                        engineArrows={bestMoveArrow}
                        userArrows={userArrows}
                        onUserArrowsChange={setUserArrows}
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
                    <PlayerBar name={bottomPlayer} rating={bottomElo} isActive={bottomActive} />
                  </div>
                </div>

                {(exploreMode || linePreview) && (
                  <div className="flex flex-col items-center gap-2 mt-3">
                    {linePreview && (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>
                          Engine line · step {linePreview.step}/{linePreview.pv.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => stepLinePreview(-1)}
                          disabled={linePreview.step <= 0}
                          className="px-2 py-1 rounded border border-board-border hover:bg-board-hover disabled:opacity-40"
                        >
                          ◀
                        </button>
                        <button
                          type="button"
                          onClick={() => stepLinePreview(1)}
                          disabled={linePreview.step >= linePreview.pv.length}
                          className="px-2 py-1 rounded border border-board-border hover:bg-board-hover disabled:opacity-40"
                        >
                          ▶
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setExploreFen(null);
                        setExploreMode(false);
                        setLinePreview(null);
                        setSelectedLineUci(null);
                        cancelPendingAnalysis();
                        clearSelection();
                      }}
                      className="text-sm px-4 py-2 rounded-lg bg-board-hover border border-board-border hover:border-gray-500 transition-all touch-manipulation min-h-[44px]"
                    >
                      ↩ Back to game line
                    </button>
                  </div>
                )}

                <BoardControls
                  onStart={() => (linePreview ? stepLinePreview(-linePreview.step) : goToPly(0))}
                  onEnd={() =>
                    linePreview
                      ? stepLinePreview(linePreview.pv.length - linePreview.step)
                      : goToPly(game.moves.length)
                  }
                  onPrev={() => (linePreview ? stepLinePreview(-1) : goToPly(currentPly - 1))}
                  onNext={() => (linePreview ? stepLinePreview(1) : goToPly(currentPly + 1))}
                  canPrev={linePreview ? linePreview.step > 0 : currentPly > 0}
                  canNext={linePreview ? linePreview.step < linePreview.pv.length : currentPly < game.moves.length}
                  currentPly={linePreview ? linePreview.step : currentPly}
                  totalPlies={linePreview ? linePreview.pv.length : game.moves.length}
                />

                <div className="mt-3 w-full">
                  <MoveList
                    game={game}
                    moves={game.moves}
                    currentPly={currentPly}
                    onSelectPly={(ply) => goToPly(ply, { collapseMoveList: false })}
                    classifications={classifications}
                    expanded={moveListExpanded}
                    onExpandedChange={setMoveListExpanded}
                    variant="default"
                    previewBranch={
                      linePreview
                        ? {
                            anchorPly: linePreview.anchorPly,
                            sanMoves: previewSanMoves,
                            currentStep: linePreview.step,
                          }
                        : null
                    }
                    onSelectPreviewStep={goToPreviewStep}
                  />
                </div>

                {evalGraphData.length > 1 && (
                  <div className="mt-3 lg:hidden">
                    <EvalGraph
                      evals={evalGraphData}
                      currentPly={currentPly}
                      onSelectPly={(ply) => goToPly(ply, { collapseMoveList: false })}
                    />
                  </div>
                )}
              </div>

              <aside
                className="order-3 w-full lg:w-[15.5rem] lg:max-w-[15.5rem] shrink-0 flex flex-col gap-2 max-h-[calc(100dvh-5rem)] overflow-y-auto lg:sticky lg:top-14 lg:self-start scroll-mt-16 relative z-20"
                data-testid="right-sidebar"
              >
                {evalGraphData.length > 1 && (
                  <div className="hidden lg:block">
                    <EvalGraph
                      evals={evalGraphData}
                      currentPly={currentPly}
                      onSelectPly={(ply) => goToPly(ply, { collapseMoveList: false })}
                    />
                  </div>
                )}
                <BestMovesPanel
                  fen={currentFen}
                  analysis={displayedAnalysis}
                  bookMoves={bookMoves}
                  bookLoading={bookLoading}
                  opening={positionOpening}
                  selectedLineUci={selectedLineUci}
                  onSelectLine={(uci) => setSelectedLineUci(uci)}
                  onPlayLine={startLinePreview}
                  playedLine={playedLine}
                />
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
