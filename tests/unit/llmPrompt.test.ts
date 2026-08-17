import { describe, expect, it } from "vitest";
import { buildMinimalCoachPrompt, coachResponseNamesColor, trimCoachResponse } from "@/lib/commentary/llmPrompt";
import { evalBarWhitePercent } from "@/components/BoardEvalBar";
import type { MultiEngineAnalysis } from "@/types";

function makeConsensus(fen: string): MultiEngineAnalysis {
  return {
    fen,
    engines: [
      {
        engineId: "t",
        engineName: "T",
        depth: 12,
        eval: 25,
        bestMoves: [{ uci: "e2e4", san: "e4", score: 25, depth: 12, pv: ["e2e4", "e7e5", "g1f3"] }],
      },
    ],
    consensusMove: "e2e4",
    consensusSan: "e4",
    agreement: 1,
    evalRange: { min: 25, max: 25 },
  };
}

describe("buildMinimalCoachPrompt", () => {
  it("uses best move only — no PGN", () => {
    const consensus = makeConsensus("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");

    const prompt = buildMinimalCoachPrompt(consensus);
    expect(prompt).toContain("Best: e4");
    expect(prompt).not.toContain("[Event");
    expect(prompt.length).toBeLessThan(200);
  });

  it("states White to move for a white-to-move FEN", () => {
    const consensus = makeConsensus("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    expect(buildMinimalCoachPrompt(consensus)).toContain("White to move.");
  });

  it("states Black to move for a black-to-move FEN — this is the side-to-move context the model was missing", () => {
    const consensus = makeConsensus("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2");
    expect(buildMinimalCoachPrompt(consensus)).toContain("Black to move.");
  });
});

describe("coachResponseNamesColor", () => {
  it("flags a reply that names White or Black despite instructions", () => {
    expect(coachResponseNamesColor("White should push the center pawn.")).toBe(true);
    expect(coachResponseNamesColor("Black's king is exposed here.")).toBe(true);
  });

  it("allows color-agnostic replies through", () => {
    expect(coachResponseNamesColor("Your king is exposed on the open file.")).toBe(false);
  });
});

describe("trimCoachResponse", () => {
  it("keeps only the first sentence and caps word count", () => {
    const long =
      "This is a very wordy explanation that goes on and on about development and center control and king safety. Second sentence should vanish.";
    const trimmed = trimCoachResponse(long, 8);
    expect(trimmed.split(" ").length).toBeLessThanOrEqual(9);
    expect(trimmed).not.toContain("Second");
  });
});

describe("evalBarWhitePercent", () => {
  it("shows full bar for forced mate", () => {
    expect(evalBarWhitePercent(0, 1)).toBe(100);
    expect(evalBarWhitePercent(0, -1)).toBe(0);
  });

  it("nudges equal positions off dead center", () => {
    expect(evalBarWhitePercent(25)).toBeGreaterThan(50);
    expect(evalBarWhitePercent(-25)).toBeLessThan(50);
  });
});
