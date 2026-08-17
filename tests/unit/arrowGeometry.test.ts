import { describe, expect, it } from "vitest";
import {
  buildArrowShape,
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

  it("builds three filled subpaths (two shaft legs + head) for knight arrows", () => {
    const d = buildArrowShape("g1", "f3", 400, "white");
    expect(d.match(/M/g)).toHaveLength(3);
    expect(d.match(/Z/g)).toHaveLength(3);
  });

  it("builds two filled subpaths (shaft + head) for sliding moves", () => {
    const d = buildArrowShape("e2", "e4", 400, "white");
    expect(d.match(/M/g)).toHaveLength(2);
    expect(d.match(/Z/g)).toHaveLength(2);
  });
});
