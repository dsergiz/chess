import { describe, it, expect } from "vitest";
import {
  ANALYSIS_MODE_PASSES,
  cacheKeyForAnalysis,
} from "@/lib/engines/analysisModes";

describe("analysisModes", () => {
  it("defaults fast mode to a single short pass", () => {
    expect(ANALYSIS_MODE_PASSES.fast).toHaveLength(1);
    expect(ANALYSIS_MODE_PASSES.fast[0].movetime).toBeLessThanOrEqual(700);
  });

  it("compare mode runs three passes", () => {
    expect(ANALYSIS_MODE_PASSES.compare).toHaveLength(3);
  });

  it("builds unique cache keys per mode", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(cacheKeyForAnalysis(fen, "fast")).not.toBe(cacheKeyForAnalysis(fen, "deep"));
  });
});
