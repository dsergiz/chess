import { describe, expect, it } from "vitest";
import { terminalPositionEval } from "@/lib/eval/positionEval";
import { whitePercentFromWinningChances, winningChancesWhitePov } from "@/lib/eval/winningChances";

const MATE_FEN = "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4";

describe("positionEval", () => {
  it("detects checkmate for eval bar", () => {
    const t = terminalPositionEval(MATE_FEN);
    expect(t?.terminal).toBe("checkmate");
    expect(t?.mate).toBe(1);
    expect(t?.terminalLabel).toContain("White wins");
  });

  it("mate winning chances push bar to extremes", () => {
    expect(whitePercentFromWinningChances(winningChancesWhitePov(0, 1))).toBeGreaterThan(95);
    expect(whitePercentFromWinningChances(winningChancesWhitePov(0, -1))).toBeLessThan(5);
  });
});
