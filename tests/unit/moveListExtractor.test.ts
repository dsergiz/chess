import { describe, it, expect } from "vitest";
import { stripParenthesizedVariations, findMoveListBlocks } from "@/lib/bookImport/moveListExtractor";

describe("stripParenthesizedVariations", () => {
  it("removes a single parenthesized span", () => {
    expect(stripParenthesizedVariations("11.d5 (11.Nbd2 cxd4) White closes the center.")).toBe(
      "11.d5  White closes the center."
    );
  });

  it("handles nested parens", () => {
    expect(stripParenthesizedVariations("1.e4 (1.d4 (1...d5) Nf6) e5")).toBe("1.e4  e5");
  });

  it("leaves text without parens untouched", () => {
    expect(stripParenthesizedVariations("1.e4 e5 2.Nf3")).toBe("1.e4 e5 2.Nf3");
  });

  it("tolerates an unmatched closing paren", () => {
    expect(stripParenthesizedVariations("1.e4 e5) 2.Nf3")).toBe("1.e4 e5 2.Nf3");
  });
});

describe("findMoveListBlocks", () => {
  it("extracts a simple movetext run", () => {
    const blocks = findMoveListBlocks("1.e4 e5 2.Nf3 Nc6 3.Bb5 a6");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].tokens.map((t) => t.raw)).toEqual(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"]);
  });

  it("ignores false-positive move numbers not followed by a SAN token (dates, page numbers)", () => {
    const text = "Published in 1985. See page 42 for details. 1.e4 e5";
    const blocks = findMoveListBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].tokens.map((t) => t.raw)).toEqual(["e4", "e5"]);
  });

  it("bridges a long prose gap when move numbers stay sequential", () => {
    const text =
      "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3 Nb8\n\n" +
      "This is a famous tabiya. White gained the bishop pair and a small structural edge, " +
      "while Black regroups toward the center with a well-known maneuver from the Ruy Lopez.\n\n" +
      "9...Nbd7 10.d4 c5";
    const blocks = findMoveListBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].tokens.map((t) => t.raw)).toEqual([
      "e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7",
      "Re1", "b5", "Bb3", "d6", "c3", "O-O", "h3", "Nb8", "Nbd7", "d4", "c5",
    ]);
  });

  it("grabs black's adjacent reply for a full move number", () => {
    const blocks = findMoveListBlocks("23.Qxh7+ Kxh7 24.Rh3+ Kg8");
    expect(blocks[0].tokens.map((t) => t.raw)).toEqual(["Qxh7+", "Kxh7", "Rh3+", "Kg8"]);
  });

  it("splits into a new block when the move number sequence resets", () => {
    const text = "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6\n\nChapter 2\n\n1.d4 Nf6 2.c4 e6";
    const blocks = findMoveListBlocks(text);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].tokens.map((t) => t.raw)).toEqual(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6"]);
    expect(blocks[1].tokens.map((t) => t.raw)).toEqual(["d4", "Nf6", "c4", "e6"]);
  });

  it("returns no blocks for prose with no movetext", () => {
    expect(findMoveListBlocks("This chapter discusses positional chess concepts in depth.")).toHaveLength(0);
  });

  it("does not loop forever or blow the stack on repeated calls", () => {
    const text = "1.e4 e5 2.Nf3 Nc6 (2...d6 3.d4) 3.Bb5 a6";
    expect(() => {
      findMoveListBlocks(stripParenthesizedVariations(text));
      findMoveListBlocks(stripParenthesizedVariations(text));
    }).not.toThrow();
  });
});
