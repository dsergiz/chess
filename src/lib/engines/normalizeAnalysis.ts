import type { Square } from "chess.js";
import { Chess, evalToWhitePerspective, sideToMoveFromFen } from "@/lib/chess";
import type { EngineResult, MultiEngineAnalysis } from "@/types";
import { buildConsensus } from "./multiEngine";

const START_POSITION_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function isLegalUci(fen: string, uci: string): boolean {
  if (!uci || uci.length < 4) return false;
  try {
    const chess = new Chess(fen);
    const from = uci.slice(0, 2) as Square;
    const to = uci.slice(2, 4) as Square;
    const promotion = uci.length > 4 ? (uci[4] as "q" | "r" | "b" | "n") : undefined;
    const move = chess.move({ from, to, promotion });
    return Boolean(move);
  } catch {
    return false;
  }
}

export function normalizeEngineResult(fen: string, engine: EngineResult): EngineResult {
  const stm = sideToMoveFromFen(fen);
  const head = evalToWhitePerspective(engine.eval, engine.mate, stm);

  const bestMoves = engine.bestMoves
    .map((move) => {
      const norm = evalToWhitePerspective(move.score, move.mate, stm);
      return {
        ...move,
        score: norm.eval,
        mate: norm.mate,
      };
    })
    .filter((move) => isLegalUci(fen, move.uci));

  return {
    ...engine,
    eval: head.eval,
    mate: head.mate,
    bestMoves,
  };
}

/** Rebuild consensus with white-POV evals and legal moves only. */
import { terminalPositionEval } from "@/lib/eval/positionEval";

export function sanitizeAnalysis(fen: string, analysis: MultiEngineAnalysis): MultiEngineAnalysis {
  if (analysis.whitePov) return analysis;

  const terminal = terminalPositionEval(fen);
  if (terminal) {
    return {
      fen,
      engines: [
        {
          engineId: "terminal",
          engineName: "Game result",
          depth: 0,
          eval: terminal.eval,
          mate: terminal.mate,
          bestMoves: [],
        },
      ],
      consensusMove: null,
      consensusSan: null,
      agreement: 1,
      evalRange: { min: terminal.eval, max: terminal.eval },
      whitePov: true,
    };
  }

  const engines = analysis.engines.map((e) => normalizeEngineResult(fen, e));
  return { ...buildConsensus(fen, engines), whitePov: true };
}

export function isStartPosition(fen: string): boolean {
  const board = fen.split(" ")[0];
  const startBoard = START_POSITION_FEN.split(" ")[0];
  return board === startBoard && fen.includes(" w ") && fen.includes(" 0 1");
}

const START_BOOK_MOVES = new Set(["e2e4", "d2d4", "g1f3", "c2c4"]);

export function filterStartPositionMoves(
  fen: string,
  analysis: MultiEngineAnalysis
): MultiEngineAnalysis | null {
  if (!isStartPosition(fen)) return analysis;

  const sanitized = sanitizeAnalysis(fen, analysis);
  const bookEngines = sanitized.engines.map((engine) => ({
    ...engine,
    bestMoves: engine.bestMoves.filter((m) => START_BOOK_MOVES.has(m.uci)),
  }));

  const withBook = buildConsensus(fen, bookEngines);
  if (withBook.consensusMove) return withBook;

  const bestBook = sanitized.engines
    .flatMap((e) => e.bestMoves)
    .find((m) => START_BOOK_MOVES.has(m.uci));
  if (bestBook) {
    return buildConsensus(fen, [
      {
        ...sanitized.engines[0]!,
        bestMoves: [bestBook],
        eval: bestBook.score,
        mate: bestBook.mate,
      },
    ]);
  }

  return {
    ...sanitized,
    consensusMove: null,
    consensusSan: null,
    engines: sanitized.engines.map((engine) => ({
      ...engine,
      bestMoves: engine.bestMoves.filter((m) => START_BOOK_MOVES.has(m.uci)),
    })),
  };
}

export function prepareAnalysisForDisplay(
  fen: string,
  analysis: MultiEngineAnalysis | null | undefined
): MultiEngineAnalysis | null {
  if (!analysis) return null;
  if (analysis.fen !== fen) return null;
  const sanitized = sanitizeAnalysis(fen, analysis);
  return filterStartPositionMoves(fen, sanitized);
}
