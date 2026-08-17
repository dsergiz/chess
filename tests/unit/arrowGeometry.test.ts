import { describe, expect, it } from "vitest";
import {
  buildArrowSegments,
  isKnightMove,
  knightCornerSquare,
} from "@/lib/board/arrowGeometry";

describe("arrowGeometry", () => {
  it("detects knight moves", () => {
    expect(isKnightMove("g1", "f3")).toBe(true);
    expect(isKnightMove("e2", "e4")).toBe(false);
  });

  it("uses L-shaped corner for knights", () => {
    expect(knightCornerSquare("g1", "f3")).toBe("g3");
    expect(knightCornerSquare("b1", "c3")).toBe("b3");
  });

  it("builds two segments for knight arrows", () => {
    const segments = buildArrowSegments("g1", "f3", 400, "white");
    expect(segments).toHaveLength(2);
  });

  it("builds one segment for sliding moves", () => {
    const segments = buildArrowSegments("e2", "e4", 400, "white");
    expect(segments).toHaveLength(1);
  });
});
