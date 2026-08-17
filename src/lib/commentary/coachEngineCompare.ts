import { formatEval, formatEvalLabel } from "@/lib/chess";
import { describeAdvantage } from "@/lib/eval/positionEval";
import type { MultiEngineAnalysis } from "@/types";

export type CoachEngineAgreement = "aligned" | "partial" | "divergent";

export interface CoachEngineAlignment {
  agreement: CoachEngineAgreement;
  engineLine: string;
  coachLine?: string;
  evalLabel: string;
  reasons: string[];
  mergedSummary: string;
}

const EQUAL_WORDS = /\b(equal|balanced|drawn|unclear|level)\b/i;
const WHITE_WORDS = /\b(white|light)\b/i;
const BLACK_WORDS = /\b(black|dark)\b/i;
const WINNING_WORDS = /\b(winning|win|crushing|decisive|dominat|mating|mate)\b/i;
const SLIGHT_WORDS = /\b(slight|small|marginal|tiny)\b/i;

function advantageSide(evalCp: number, mate?: number): "white" | "black" | "equal" {
  if (mate !== undefined) return mate > 0 ? "white" : mate < 0 ? "black" : "equal";
  if (Math.abs(evalCp) < 25) return "equal";
  return evalCp > 0 ? "white" : "black";
}

function strengthBucket(evalCp: number, mate?: number): "equal" | "slight" | "clear" | "winning" {
  if (mate !== undefined) return "winning";
  const pawns = Math.abs(evalCp) / 100;
  if (pawns < 0.35) return "equal";
  if (pawns < 1.2) return "slight";
  if (pawns < 3) return "clear";
  return "winning";
}

function sideFromText(text: string): "white" | "black" | "equal" | null {
  const lower = text.toLowerCase();
  const white = WHITE_WORDS.test(lower);
  const black = BLACK_WORDS.test(lower);
  if (white && black) return null;
  if (white) return "white";
  if (black) return "black";
  if (EQUAL_WORDS.test(lower)) return "equal";
  return null;
}

function strengthFromText(text: string): "equal" | "slight" | "clear" | "winning" | null {
  const lower = text.toLowerCase();
  if (EQUAL_WORDS.test(lower)) return "equal";
  if (SLIGHT_WORDS.test(lower)) return "slight";
  if (WINNING_WORDS.test(lower) || /\bmate\b/i.test(lower)) return "winning";
  if (/\b(clear|strong|better|pressure|initiative)\b/i.test(lower)) return "clear";
  return null;
}

/** Compare Stockfish-backed summary with optional LLM coach text. */
export function compareCoachWithEngine(
  consensus: MultiEngineAnalysis,
  engineSummary: string,
  coachLine?: string | null
): CoachEngineAlignment {
  const top = consensus.engines[0];
  const evalCp = top?.eval ?? 0;
  const mate = top?.mate;
  const evalLabel = formatEvalLabel(evalCp, mate, "w");
  const best = consensus.consensusSan ?? top?.bestMoves[0]?.san;
  const engineLine = [
    describeAdvantage(evalCp, mate),
    best ? `Best: ${best}.` : "",
    `Stockfish ${formatEval(evalCp, mate, "w")}.`,
  ]
    .filter(Boolean)
    .join(" ");

  if (!coachLine?.trim()) {
    return {
      agreement: "aligned",
      engineLine,
      evalLabel,
      reasons: [],
      mergedSummary: engineSummary || engineLine,
    };
  }

  const coach = coachLine.trim();
  const reasons: string[] = [];
  const engineSide = advantageSide(evalCp, mate);
  const coachSide = sideFromText(coach);

  if (coachSide && engineSide !== "equal" && coachSide !== engineSide) {
    reasons.push(`Coach mentions ${coachSide}; Stockfish favors ${engineSide}.`);
  }

  const engineStrength = strengthBucket(evalCp, mate);
  const coachStrength = strengthFromText(coach);
  if (
    coachStrength &&
    engineStrength !== coachStrength &&
    !(engineStrength === "clear" && coachStrength === "slight") &&
    !(engineStrength === "winning" && coachStrength === "clear")
  ) {
    reasons.push(`Coach tone (${coachStrength}) vs Stockfish (${engineStrength}).`);
  }

  let agreement: CoachEngineAgreement = "aligned";
  if (reasons.length >= 2) agreement = "divergent";
  else if (reasons.length === 1) agreement = "partial";

  const mergedSummary =
    agreement === "aligned"
      ? `${engineLine} ${coach}`
      : agreement === "partial"
        ? `${engineLine} Coach adds: ${coach}`
        : `${engineLine} Coach note (differs): ${coach}`;

  return {
    agreement,
    engineLine,
    coachLine: coach,
    evalLabel,
    reasons,
    mergedSummary,
  };
}

export function mergePositionCommentary(
  ruleBased: {
    summary: string;
    tacticalThemes: string[];
    bestLineExplanation: string;
    pathToPosition: string;
    engineNotes: string[];
  },
  consensus: MultiEngineAnalysis,
  coachLine?: string | null
) {
  const alignment = compareCoachWithEngine(consensus, ruleBased.summary, coachLine);
  return {
    summary: alignment.mergedSummary,
    tacticalThemes: ruleBased.tacticalThemes.slice(0, 2),
    bestLineExplanation: ruleBased.bestLineExplanation,
    pathToPosition: ruleBased.pathToPosition,
    engineNotes: [
      `Stockfish ${alignment.evalLabel}`,
      coachLine
        ? alignment.agreement === "aligned"
          ? "Coach aligns with engine"
          : alignment.agreement === "partial"
            ? "Coach partly differs"
            : "Coach diverges from engine"
        : "Engine only",
    ],
    alignment,
    source: coachLine ? ("merged" as const) : ("rules" as const),
  };
}
