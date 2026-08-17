import { describe, expect, it } from "vitest";
import { parseExplorerMoves } from "@/lib/openingExplorer";

describe("openingExplorer", () => {
  it("parses lichess explorer moves with popularity", () => {
    const moves = parseExplorerMoves({
      moves: [
        { uci: "e2e4", san: "e4", white: 400, draws: 300, black: 300 },
        { uci: "d2d4", san: "d4", white: 200, draws: 150, black: 150 },
      ],
    });

    expect(moves).toHaveLength(2);
    expect(moves[0].san).toBe("e4");
    expect(moves[0].totalGames).toBe(1000);
    expect(moves[0].whitePct).toBeCloseTo(40, 0);
  });

  it("returns empty for missing data", () => {
    expect(parseExplorerMoves({})).toEqual([]);
    expect(parseExplorerMoves({ moves: [] })).toEqual([]);
  });
});
