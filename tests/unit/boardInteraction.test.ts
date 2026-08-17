import { describe, it, expect } from "vitest";
import {
  buildMoveHintStyles,
  castlingRookMove,
  legalMovesFrom,
  pieceAt,
  sideToMove,
  tryMove,
} from "@/lib/boardInteraction";
import type { Square } from "chess.js";

describe("boardInteraction", () => {
  const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  it("finds legal moves for selected pawn", () => {
    const moves = legalMovesFrom(startFen, "e2" as Square);
    expect(moves.length).toBe(2);
    expect(moves.map((m) => m.to)).toContain("e4");
  });

  it("builds hint styles for selected square", () => {
    const moves = legalMovesFrom(startFen, "e2" as Square);
    const styles = buildMoveHintStyles("e2" as Square, moves);
    expect(styles.e2).toBeDefined();
    expect(styles.e4).toBeDefined();
  });

  it("applies moves via tryMove", () => {
    const result = tryMove(startFen, "e2" as Square, "e4" as Square);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.fen).toContain("4P3");
  });

  it("reads piece at square", () => {
    expect(pieceAt(startFen, "e2" as Square)).toBe("wP");
    expect(pieceAt(startFen, "e4" as Square)).toBeNull();
  });

  it("detects side to move", () => {
    expect(sideToMove(startFen)).toBe("w");
  });
});

describe("castlingRookMove", () => {
  it("maps white kingside castling to the rook's h1-f1 move", () => {
    expect(castlingRookMove("O-O", "w")).toEqual({ from: "h1", to: "f1" });
  });

  it("maps white queenside castling to the rook's a1-d1 move", () => {
    expect(castlingRookMove("O-O-O", "w")).toEqual({ from: "a1", to: "d1" });
  });

  it("maps black kingside castling to the rook's h8-f8 move", () => {
    expect(castlingRookMove("O-O", "b")).toEqual({ from: "h8", to: "f8" });
  });

  it("maps black queenside castling to the rook's a8-d8 move", () => {
    expect(castlingRookMove("O-O-O", "b")).toEqual({ from: "a8", to: "d8" });
  });

  it("strips trailing check/mate/annotation glyphs before matching", () => {
    expect(castlingRookMove("O-O+", "w")).toEqual({ from: "h1", to: "f1" });
    expect(castlingRookMove("O-O-O#", "b")).toEqual({ from: "a8", to: "d8" });
  });

  it("returns null for a non-castling move", () => {
    expect(castlingRookMove("Nf3", "w")).toBeNull();
  });
});
