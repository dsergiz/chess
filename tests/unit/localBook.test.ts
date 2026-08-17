import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { localBookMoves } from "@/lib/openings/localBook";

function fenAfter(sanMoves: string[]): string {
  const chess = new Chess();
  sanMoves.forEach((san) => chess.move(san));
  return chess.fen();
}

describe("localBookMoves", () => {
  it("returns the main first-move choices from the starting position", () => {
    const moves = localBookMoves(new Chess().fen());
    expect(moves.map((m) => m.san)).toEqual(["e4", "d4", "Nf3", "c4"]);
    expect(moves[0].uci).toBe("e2e4");
  });

  it("covers a deep, well-known theoretical line (Ruy Lopez)", () => {
    const fen = fenAfter(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"]);
    const moves = localBookMoves(fen);
    expect(moves.map((m) => m.san)).toContain("Ba4");
  });

  it("falls back to an empty list once a position leaves the curated book", () => {
    const fen = fenAfter(["a4", "a5", "h4", "h5"]);
    expect(localBookMoves(fen)).toEqual([]);
  });

  it("every entry carries a self-consistent win/draw/loss split", () => {
    for (const move of localBookMoves(new Chess().fen())) {
      expect(move.whitePct + move.drawPct + move.blackPct).toBeCloseTo(100, 0);
      expect(move.totalGames).toBeGreaterThan(0);
    }
  });
});
