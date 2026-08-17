import { describe, expect, it } from "vitest";
import { buildConsensus } from "@/lib/engines/multiEngine";
import {
  isLegalUci,
  isStartPosition,
  normalizeEngineResult,
  prepareAnalysisForDisplay,
  sanitizeAnalysis,
} from "@/lib/engines/normalizeAnalysis";
import type { EngineResult } from "@/types";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("normalizeAnalysis", () => {
  it("detects start position", () => {
    expect(isStartPosition(START_FEN)).toBe(true);
  });

  it("validates legal UCI moves", () => {
    expect(isLegalUci(START_FEN, "e2e4")).toBe(true);
    expect(isLegalUci(START_FEN, "a2a3")).toBe(true);
    expect(isLegalUci(START_FEN, "a1a2")).toBe(false);
  });

  it("normalizes black-to-move eval to white POV", () => {
    const fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    const engine: EngineResult = {
      engineId: "t",
      engineName: "T",
      depth: 12,
      eval: 30,
      bestMoves: [{ uci: "g8f6", san: "Nf6", score: 30, depth: 12, pv: ["g8f6"] }],
    };
    const normalized = normalizeEngineResult(fen, engine);
    expect(normalized.eval).toBe(-30);
  });

  it("filters non-book moves at start position", () => {
    const engines: EngineResult[] = [
      {
        engineId: "t",
        engineName: "T",
        depth: 12,
        eval: 25,
        bestMoves: [{ uci: "a2a3", san: "a3", score: 25, depth: 12, pv: ["a2a3"] }],
      },
    ];
    const raw = buildConsensus(START_FEN, engines);
    const prepared = prepareAnalysisForDisplay(START_FEN, raw);
    expect(prepared).not.toBeNull();
    expect(prepared?.consensusMove).toBeNull();
    expect(prepared?.engines[0]?.bestMoves).toHaveLength(0);
    expect(prepared?.engines[0]?.eval).toBe(25);
  });

  it("rejects analysis when FEN mismatches", () => {
    const engines: EngineResult[] = [
      {
        engineId: "t",
        engineName: "T",
        depth: 12,
        eval: 25,
        bestMoves: [{ uci: "e2e4", san: "e4", score: 25, depth: 12, pv: ["e2e4"] }],
      },
    ];
    const analysis = sanitizeAnalysis(START_FEN, buildConsensus(START_FEN, engines));
    expect(prepareAnalysisForDisplay("wrong fen", analysis)).toBeNull();
  });
});
