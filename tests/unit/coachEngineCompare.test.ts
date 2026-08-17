import { describe, it, expect } from "vitest";
import { buildConsensus } from "@/lib/engines/multiEngine";
import {
  compareCoachWithEngine,
  mergePositionCommentary,
} from "@/lib/commentary/coachEngineCompare";
import type { EngineResult } from "@/types";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function consensusWithEval(evalCp: number, mate?: number) {
  const engines: EngineResult[] = [
    {
      engineId: "sf",
      engineName: "Stockfish",
      depth: 16,
      eval: evalCp,
      mate,
      bestMoves: [{ uci: "e2e4", san: "e4", score: evalCp, depth: 16, pv: ["e2e4"] }],
    },
  ];
  return buildConsensus(START_FEN, engines);
}

describe("compareCoachWithEngine", () => {
  it("treats missing coach as aligned with engine-only summary", () => {
    const consensus = consensusWithEval(0);
    const alignment = compareCoachWithEngine(consensus, "The position is equal.", null);

    expect(alignment.agreement).toBe("aligned");
    expect(alignment.coachLine).toBeUndefined();
    expect(alignment.engineLine).toMatch(/equal/i);
  });

  it("flags divergent coach when side and strength disagree", () => {
    const consensus = consensusWithEval(500);
    const alignment = compareCoachWithEngine(
      consensus,
      "White is winning.",
      "Black has a slight edge."
    );

    expect(alignment.agreement).toBe("divergent");
    expect(alignment.reasons.length).toBeGreaterThanOrEqual(2);
  });

  it("marks partial disagreement when tone differs without side mismatch", () => {
    const consensus = consensusWithEval(200);
    const alignment = compareCoachWithEngine(
      consensus,
      "White is clearly better.",
      "White is winning here."
    );

    expect(alignment.agreement).toBe("partial");
    expect(alignment.reasons).toHaveLength(1);
  });

  it("marks aligned when coach matches engine side", () => {
    const consensus = consensusWithEval(120);
    const alignment = compareCoachWithEngine(
      consensus,
      "White is better.",
      "White has a clear initiative."
    );

    expect(alignment.agreement).toBe("aligned");
    expect(alignment.reasons).toHaveLength(0);
  });
});

describe("mergePositionCommentary", () => {
  it("merges coach text and exposes alignment on commentary", () => {
    const consensus = consensusWithEval(50);
    const ruleBased = {
      summary: "Roughly equal.",
      tacticalThemes: ["space"],
      bestLineExplanation: "Play e4.",
      pathToPosition: "Start",
      engineNotes: [],
    };

    const merged = mergePositionCommentary(ruleBased, consensus, "White is slightly better.");

    expect(merged.source).toBe("merged");
    expect(merged.alignment?.coachLine).toBe("White is slightly better.");
    expect(merged.summary).toContain("Coach");
    expect(merged.engineNotes[0]).toMatch(/Stockfish/i);
  });
});
