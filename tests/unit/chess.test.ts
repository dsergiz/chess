import { describe, it, expect } from "vitest";
import {
  parsePgn,
  fenAtPly,
  pathToPly,
  classifyMove,
  formatEval,
  detectTacticalThemes,
  uciToSan,
  evalToWhitePerspective,
  computeMoveEvalLoss,
  replaySanTokens,
  refineClassification,
} from "@/lib/chess";
import { buildConsensus } from "@/lib/engines/multiEngine";
import { generatePositionCommentary } from "@/lib/commentary/generator";
import type { EngineResult, GameMove } from "@/types";

const SAMPLE_PGN = `[Event "Test"]
[White "Alice"]
[Black "Bob"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 1-0`;

describe("parsePgn", () => {
  it("parses moves with correct ply count", () => {
    const game = parsePgn(SAMPLE_PGN);
    expect(game.moves.length).toBe(20);
    expect(game.moves[0].san).toBe("e4");
    expect(game.moves[0].ply).toBe(1);
    expect(game.moves[0].color).toBe("w");
  });

  it("extracts headers", () => {
    const game = parsePgn(SAMPLE_PGN);
    expect(game.headers.White).toBe("Alice");
    expect(game.headers.Black).toBe("Bob");
    expect(game.headers.Result).toBe("1-0");
  });

  it("tracks FEN after each move", () => {
    const game = parsePgn(SAMPLE_PGN);
    expect(game.moves[0].fen).toContain("4P3");
  });
});

describe("fenAtPly", () => {
  it("returns starting FEN at ply 0", () => {
    const game = parsePgn(SAMPLE_PGN);
    expect(fenAtPly(game, 0)).toBe(game.startingFen);
  });

  it("returns correct FEN at given ply", () => {
    const game = parsePgn(SAMPLE_PGN);
    expect(fenAtPly(game, 1)).toBe(game.moves[0].fen);
  });
});

describe("pathToPly", () => {
  it("formats move path as SAN notation", () => {
    const game = parsePgn(SAMPLE_PGN);
    const path = pathToPly(game, 4);
    expect(path).toContain("1. e4 e5");
    expect(path).toContain("2. Nf3 Nc6");
  });
});

describe("classifyMove", () => {
  it("classifies best moves", () => {
    expect(classifyMove(0)).toBe("best");
    expect(classifyMove(0.04)).toBe("best");
  });

  it("classifies blunders", () => {
    expect(classifyMove(1.5)).toBe("blunder");
    expect(classifyMove(3)).toBe("blunder");
  });
});

describe("formatEval", () => {
  it("formats centipawn scores", () => {
    expect(formatEval(50)).toBe("+0.50");
    expect(formatEval(-30)).toBe("-0.30");
  });

  it("formats mate scores", () => {
    expect(formatEval(10000, 3)).toBe("#3");
  });
});

describe("uciToSan", () => {
  it("converts UCI to SAN from starting position", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(uciToSan(fen, "e2e4")).toBe("e4");
    expect(uciToSan(fen, "g1f3")).toBe("Nf3");
  });
});

describe("detectTacticalThemes", () => {
  it("detects starting position themes", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const themes = detectTacticalThemes(fen);
    expect(themes).toContain("Material equality");
  });
});

describe("buildConsensus", () => {
  it("finds consensus when engines agree", () => {
    const engines: EngineResult[] = [
      {
        engineId: "a",
        engineName: "A",
        depth: 15,
        eval: 30,
        bestMoves: [{ uci: "e2e4", san: "e4", score: 30, depth: 15, pv: ["e2e4"] }],
      },
      {
        engineId: "b",
        engineName: "B",
        depth: 18,
        eval: 25,
        bestMoves: [{ uci: "e2e4", san: "e4", score: 25, depth: 18, pv: ["e2e4"] }],
      },
    ];
    const consensus = buildConsensus(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      engines
    );
    expect(consensus.consensusMove).toBe("e2e4");
    expect(consensus.agreement).toBe(1);
  });

  it("handles engine disagreement", () => {
    const engines: EngineResult[] = [
      {
        engineId: "a",
        engineName: "A",
        depth: 15,
        eval: 30,
        bestMoves: [{ uci: "e2e4", san: "e4", score: 30, depth: 15, pv: ["e2e4"] }],
      },
      {
        engineId: "b",
        engineName: "B",
        depth: 18,
        eval: 20,
        bestMoves: [{ uci: "d2d4", san: "d4", score: 20, depth: 18, pv: ["d2d4"] }],
      },
    ];
    const consensus = buildConsensus(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      engines
    );
    expect(consensus.agreement).toBe(0.5);
  });
});

describe("generatePositionCommentary", () => {
  it("generates commentary with path and engine notes", () => {
    const game = parsePgn(SAMPLE_PGN);
    const engines: EngineResult[] = [
      {
        engineId: "a",
        engineName: "Stockfish (Fast)",
        depth: 12,
        eval: 25,
        bestMoves: [{ uci: "e2e4", san: "e4", score: 25, depth: 12, pv: ["e2e4", "e7e5"] }],
      },
    ];
    const consensus = buildConsensus(game.startingFen, engines);
    const commentary = generatePositionCommentary(game, 0, consensus);

    expect(commentary.summary.toLowerCase()).toMatch(/better|worse|equal/);
    expect(commentary.pathToPosition.toLowerCase()).toContain("starting");
    expect(commentary.bestLineExplanation.length).toBeGreaterThan(0);
    expect(consensus.fen).toBe(game.startingFen);
  });
});

describe("evalToWhitePerspective", () => {
  it("flips eval when Black is to move", () => {
    const result = evalToWhitePerspective(80, undefined, "b");
    expect(result.eval).toBe(-80);
  });

  it("keeps eval when White is to move", () => {
    const result = evalToWhitePerspective(50, undefined, "w");
    expect(result.eval).toBe(50);
  });
});

describe("computeMoveEvalLoss white POV cache", () => {
  it("does not double-flip already normalized evals", () => {
    const game = parsePgn("1. e4 e5 2. Nf3", "t");
    const cache = new Map<number, { engines: { eval: number; mate?: number; bestMoves: { uci: string; score: number; mate?: number }[] }[] }>();
    cache.set(0, {
      engines: [{ eval: 25, bestMoves: [{ uci: "e2e4", san: "e4", score: 25, depth: 12, pv: ["e2e4"] }] }],
    });
    cache.set(1, {
      engines: [{ eval: 30, bestMoves: [{ uci: "e7e5", san: "e5", score: 30, depth: 12, pv: ["e7e5"] }] }],
    });
    cache.set(2, {
      engines: [{ eval: 35, bestMoves: [{ uci: "g1f3", san: "Nf3", score: 35, depth: 12, pv: ["g1f3"] }] }],
    });

    const loss = computeMoveEvalLoss(game, 1, cache, true);
    expect(loss).toBe(0);
  });
});

describe("replaySanTokens", () => {
  it("replays a clean bare SAN token list from the standard start position", () => {
    const result = replaySanTokens(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"]);
    expect(result.skipped).toEqual([]);
    expect(result.game.moves).toHaveLength(6);
    expect(result.game.moves[0].san).toBe("e4");
    expect(result.game.moves[0].uci).toBe("e2e4");
    expect(result.game.startingFen).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    expect(result.game.moves.at(-1)?.fen).toContain(" w "); // Black just moved (a6), White is to move next
  });

  it("skips illegal or unparseable tokens and continues the replay", () => {
    const result = replaySanTokens(["e4", "e5", "Zx9", "Nf3", "Nc6"]);
    expect(result.skipped).toEqual([{ token: "Zx9", index: 2 }]);
    expect(result.game.moves.map((m) => m.san)).toEqual(["e4", "e5", "Nf3", "Nc6"]);
    // plies renumber sequentially over the accepted moves only, skipping the rejected token
    expect(result.game.moves.map((m) => m.ply)).toEqual([1, 2, 3, 4]);
  });

  it("honors a starting FEN override", () => {
    const setup = parsePgn("1. e4 e5 2. Nf3 Nc6");
    const midgameFen = setup.moves.at(-1)!.fen;
    const result = replaySanTokens(["Bb5", "a6"], midgameFen);
    expect(result.game.startingFen).toBe(midgameFen);
    expect(result.skipped).toEqual([]);
    expect(result.game.moves[0].san).toBe("Bb5");
  });

  it("marks castling and checks correctly, matching parsePgn's output shape", () => {
    const result = replaySanTokens(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O"]);
    const castle = result.game.moves.at(-1);
    expect(castle?.isCastle).toBe(true);
  });
});

describe("refineClassification", () => {
  function makeMove(overrides: Partial<GameMove>): GameMove {
    return {
      san: "Nf3",
      uci: "g1f3",
      fen: "startpos",
      ply: 1,
      color: "w",
      isCheck: false,
      isCastle: false,
      isPromotion: false,
      ...overrides,
    };
  }

  it("tags an engine-accurate opening move as book", () => {
    const move = makeMove({ ply: 4 });
    const result = refineClassification("best", { ply: 4, move, afterFen: move.fen, evalBeforeWhite: 20 });
    expect(result).toBe("book");
  });

  it("tags a genuine material sacrifice landing on an attacked square as brilliant", () => {
    // White queen just captured a knight on d8; a black rook on d1 covers the d-file.
    const afterFen = "3Q3k/8/8/8/8/8/8/3r3K b - - 0 1";
    const move = makeMove({ san: "Qxd8", uci: "h4d8", captured: "n", ply: 20, fen: afterFen });
    const result = refineClassification("best", { ply: 20, move, afterFen, evalBeforeWhite: 50 });
    expect(result).toBe("brilliant");
  });

  it("does not award brilliant when the position is already decisively won", () => {
    const afterFen = "3Q3k/8/8/8/8/8/8/3r3K b - - 0 1";
    const move = makeMove({ san: "Qxd8", uci: "h4d8", captured: "n", ply: 20, fen: afterFen });
    const result = refineClassification("best", { ply: 20, move, afterFen, evalBeforeWhite: 1000 });
    expect(result).toBe("best");
  });

  it("does not award brilliant for a favorable trade (not a real sacrifice)", () => {
    // Rook captures a queen — moved piece is worth less than what it captured.
    const afterFen = "3R3k/8/8/8/8/8/8/3r3K b - - 0 1";
    const move = makeMove({ san: "Rxd8", uci: "h4d8", captured: "q", ply: 20, fen: afterFen });
    const result = refineClassification("best", { ply: 20, move, afterFen, evalBeforeWhite: 50 });
    expect(result).toBe("best");
  });

  it("tags a standout best move (large gap over the 2nd-best) as great, outside book range", () => {
    const move = makeMove({ ply: 20, fen: "irrelevant-fen-for-this-case" });
    const result = refineClassification("best", {
      ply: 20,
      move,
      afterFen: move.fen,
      evalBeforeWhite: 50,
      bestMoves: [
        { uci: "a1a2", score: 300 },
        { uci: "b1b2", score: 100 },
      ],
    });
    expect(result).toBe("great");
  });

  it("tags a mistake/blunder as a miss when a much better move was clearly available", () => {
    const move = makeMove({ ply: 20 });
    const result = refineClassification("blunder", {
      ply: 20,
      move,
      afterFen: move.fen,
      evalBeforeWhite: 50,
      bestMoves: [
        { uci: "a1a2", score: 300 },
        { uci: "b1b2", score: 50 },
      ],
    });
    expect(result).toBe("miss");
  });

  it("leaves the base classification alone when no refinement signal applies", () => {
    const move = makeMove({ ply: 20 });
    expect(refineClassification("good", { ply: 20, move, afterFen: move.fen, evalBeforeWhite: 50 })).toBe("good");
    expect(refineClassification("mistake", { ply: 20, move, afterFen: move.fen, evalBeforeWhite: 50 })).toBe(
      "mistake"
    );
  });
});
