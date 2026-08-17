import type {
  EngineResult,
  MoveAnalysis,
  MultiEngineAnalysis,
  PositionCommentary,
} from "@/types";
import {
  classifyMove,
  detectTacticalThemes,
  formatEval,
  pathToPly,
  pieceName,
  uciToSan,
} from "../chess";
import { describeAdvantage, terminalPositionEval } from "../eval/positionEval";
import type { ImportedGame } from "@/types";
import { detectTacticalMotifs, explainBestMoveIdea } from "../tactics/motifs";

function explainMove(
  fen: string,
  bestUci: string,
  engine: EngineResult
): string {
  const san = uciToSan(fen, bestUci);
  const top = engine.bestMoves[0];
  if (!top) return `${san} is the practical choice here.`;

  if (top.mate !== undefined) {
    return top.mate > 0
      ? `${san} forces mate in ${Math.abs(top.mate)} — the win is tactical, not positional.`
      : `${san} is the only move that delays mate in ${Math.abs(top.mate)}.`;
  }

  return explainBestMoveIdea(fen, san, top.pv);
}

function explainPositionChange(
  beforeFen: string,
  afterFen: string,
  moveSan: string,
  captured?: string
): string {
  const parts: string[] = [];

  if (captured) {
    parts.push(`wins the ${pieceName(captured)}`);
  }

  const motifsAfter = detectTacticalMotifs(afterFen);
  const motifsBefore = detectTacticalMotifs(beforeFen);

  const newCheck = motifsAfter.find((m) => m.type === "check");
  if (newCheck && !motifsBefore.some((m) => m.type === "check")) {
    parts.push("checks the king");
  }

  const newPin = motifsAfter.find((m) => m.type === "pin");
  if (newPin && !motifsBefore.some((m) => m.type === "pin")) {
    parts.push("creates a pin");
  }

  if (parts.length === 0) {
    parts.push("improves piece activity");
  }

  return `${moveSan} ${parts.join(" and ")}.`;
}

export function generateMoveCommentary(
  game: ImportedGame,
  ply: number,
  playedUci: string,
  playedSan: string,
  consensus: MultiEngineAnalysis,
  playedEval: number,
  bestEval: number,
  captured?: string
): string {
  const beforeFen = ply <= 1 ? game.startingFen : game.moves[ply - 2].fen;
  const afterFen = game.moves[ply - 1]?.fen ?? beforeFen;
  const evalLoss = Math.max(0, (bestEval - playedEval) / 100);
  const classification = classifyMove(evalLoss);
  const bestMove = consensus.consensusMove;
  const bestSan = consensus.consensusSan ?? bestMove ?? "";

  const lines: string[] = [];

  if (playedUci === bestMove) {
    lines.push(`${playedSan} is engine-accurate — you found the critical move.`);
  } else {
    const lossDesc =
      classification === "blunder"
        ? "This blunder"
        : classification === "mistake"
          ? "This mistake"
          : classification === "inaccuracy"
            ? "This inaccuracy"
            : "This choice";

    lines.push(
      `${lossDesc} hands the opponent about ${evalLoss.toFixed(1)} pawns. Prefer ${bestSan}.`
    );
  }

  lines.push(explainPositionChange(beforeFen, afterFen, playedSan, captured));

  if (bestMove && playedUci !== bestMove) {
    const topEngine = consensus.engines[0];
    if (topEngine) {
      lines.push(explainMove(beforeFen, bestMove, topEngine));
    }
  }

  return lines.join(" ");
}

export function generatePositionCommentary(
  game: ImportedGame,
  ply: number,
  consensus: MultiEngineAnalysis,
  options?: { isVariation?: boolean }
): PositionCommentary {
  const fen = consensus.fen;
  const boardThemes = detectTacticalThemes(fen);
  const motifs = detectTacticalMotifs(fen);
  const basePath = pathToPly(game, ply);
  const path = options?.isVariation
    ? `Variation after ${basePath === "Starting position" ? "start" : basePath}`
    : basePath;

  const topEngine = consensus.engines[0];
  const bestMove = consensus.consensusSan ?? "—";
  const terminal = terminalPositionEval(fen);
  const evalStr = topEngine ? formatEval(topEngine.eval, topEngine.mate) : "0.00";

  let bestLineExplanation = "";
  if (consensus.consensusMove && topEngine) {
    bestLineExplanation = explainMove(fen, consensus.consensusMove, topEngine);
  }

  const tacticalThemes = [
    ...motifs.map((m) => m.description),
    ...boardThemes.filter((t) => !t.includes("equality")),
  ].slice(0, 4);

  const summaryParts: string[] = [];
  if (terminal?.terminalLabel) {
    summaryParts.push(terminal.terminalLabel + ".");
  } else if (topEngine) {
    summaryParts.push(describeAdvantage(topEngine.eval, topEngine.mate));
    summaryParts.push(`Engine: ${evalStr}.`);
  }
  if (bestMove !== "—" && !terminal?.terminal) {
    summaryParts.push(`Best: ${bestMove}.`);
  }

  return {
    summary: summaryParts.join(" "),
    tacticalThemes,
    bestLineExplanation,
    pathToPosition: path,
    engineNotes: [],
  };
}

export function buildMoveAnalysis(
  game: ImportedGame,
  ply: number,
  consensus: MultiEngineAnalysis,
  playedEval: number,
  bestEval: number
): MoveAnalysis {
  const move = game.moves[ply - 1];
  const evalLoss = Math.max(0, (bestEval - playedEval) / 100);

  return {
    ply,
    san: move.san,
    uci: move.uci,
    fen: move.fen,
    playedEval,
    bestEval,
    evalLoss,
    classification: classifyMove(evalLoss),
    bestMove: consensus.consensusMove ?? "",
    bestMoveSan: consensus.consensusSan ?? "",
    commentary: generateMoveCommentary(
      game,
      ply,
      move.uci,
      move.san,
      consensus,
      playedEval,
      bestEval,
      move.captured
    ),
    engineConsensus: consensus,
  };
}
