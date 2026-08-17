import type { MultiEngineAnalysis } from "@/types";
import { sideToMoveFromFen } from "../chess";

export const CHESS_COACH_SYSTEM = `Chess coach. Reply in ONE sentence, maximum 12 words. State the idea or threat only. Never say "White" or "Black" — address the side to move directly ("you", "your king"), since the prompt already tells you who that is. No greetings, no "the position", no engine jargon.`;

/**
 * Smallest useful payload for a local LLM — no PGN, no images, no full game.
 *
 * The side to move is stated explicitly (derived from the FEN) so the model has no ambiguity
 * about which color the recommended move belongs to — small local models will otherwise guess,
 * and sometimes guess the wrong color, producing commentary that contradicts the rule-based text
 * for the same position (which is always correct, since it comes straight from the engine's own
 * side-to-move-relative output).
 */
export function buildMinimalCoachPrompt(consensus: MultiEngineAnalysis): string {
  const sideToMove = sideToMoveFromFen(consensus.fen);
  const sideLabel = sideToMove === "w" ? "White" : "Black";
  const top = consensus.engines[0];
  const best = consensus.consensusSan ?? top?.bestMoves[0]?.san ?? "?";
  const pv = top?.bestMoves[0]?.pv?.slice(0, 3).join(" ") ?? "";
  const evalPart =
    top?.mate !== undefined
      ? top.mate > 0
        ? `White mates in ${top.mate}`
        : top.mate < 0
          ? `Black mates in ${Math.abs(top.mate)}`
          : "Checkmate"
      : top
        ? `${top.eval > 0 ? "+" : ""}${(top.eval / 100).toFixed(1)}`
        : "0.0";

  return [
    `${sideLabel} to move.`,
    `Best: ${best}`,
    `Eval: ${evalPart}`,
    pv ? `PV: ${pv}` : "",
    "Why that move? One sentence, do not name the color.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Keep LLM output tight even if the model runs long. */
export function trimCoachResponse(text: string, maxWords = 14): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";

  const firstChunk = cleaned.split(/(?<=[.!?])\s+/)[0] ?? cleaned;
  const words = firstChunk.split(" ").filter(Boolean);
  if (words.length <= maxWords) {
    return firstChunk.replace(/\.$/, "") + (firstChunk.match(/[.!?]$/) ? "" : ".");
  }
  return words.slice(0, maxWords).join(" ") + "…";
}

/**
 * Defense-in-depth: even though the prompt/system message forbid naming a color, small local
 * models don't reliably follow instructions. If the reply still names one, it's not trustworthy
 * enough to merge into the displayed commentary — better to fall back to the (always-correct)
 * rule-based text than risk showing a coach line about the wrong side.
 */
export function coachResponseNamesColor(text: string): boolean {
  return /\b(white|black)\b/i.test(text);
}
