import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { parsePgn, uciToSan, fenAtPly, pathToPly } from "@/lib/chess";
import { buildMoveAnalysis, generateMoveCommentary } from "@/lib/commentary/generator";
import { buildConsensus } from "@/lib/engines/multiEngine";
import { formatGameResult, formatTimeControl, gameTitle, normalizeChessComGame } from "@/lib/chesscom";
import type { ChessComGame, EngineResult } from "@/types";

const SAMPLE_PGN = `[Event "Test"]
[White "Alice"]
[Black "Bob"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 1-0`;

describe("uciToSan edge cases", () => {
  it("converts knight development UCI", () => {
    const fen = new Chess().fen();
    expect(uciToSan(fen, "g1f3")).toBe("Nf3");
  });

  it("returns uci when move is illegal", () => {
    const fen = new Chess().fen();
    expect(uciToSan(fen, "a1a2")).toBe("a1a2");
  });
});

describe("buildMoveAnalysis", () => {
  it("builds analysis for a played move", () => {
    const game = parsePgn(SAMPLE_PGN);
    const engines: EngineResult[] = [
      {
        engineId: "a",
        engineName: "A",
        depth: 15,
        eval: 30,
        bestMoves: [{ uci: "e2e4", san: "e4", score: 30, depth: 15, pv: ["e2e4"] }],
      },
    ];
    const consensus = buildConsensus(game.startingFen, engines);
    const analysis = buildMoveAnalysis(game, 1, consensus, 30, 30);

    expect(analysis.san).toBe("e4");
    expect(analysis.classification).toBe("best");
    expect(analysis.commentary.length).toBeGreaterThan(0);
  });
});

describe("generateMoveCommentary", () => {
  it("flags suboptimal moves", () => {
    const game = parsePgn(SAMPLE_PGN);
    const engines: EngineResult[] = [
      {
        engineId: "a",
        engineName: "A",
        depth: 15,
        eval: 50,
        bestMoves: [{ uci: "g1f3", san: "Nf3", score: 50, depth: 15, pv: ["g1f3"] }],
      },
    ];
    const consensus = buildConsensus(game.moves[0].fen, engines);
    const commentary = generateMoveCommentary(
      game,
      2,
      game.moves[1].uci,
      game.moves[1].san,
      consensus,
      0,
      50,
      undefined
    );

    expect(commentary.toLowerCase()).toMatch(/mistake|inaccuracy|suboptimal|loses/);
  });
});

describe("chesscom helpers", () => {
  const mockGame: ChessComGame = {
    uuid: "1",
    url: "https://chess.com",
    pgn: SAMPLE_PGN,
    timeControl: "600+0",
    endTime: 1700000000,
    rated: true,
    white: { username: "alice", rating: 1500, result: "win" },
    black: { username: "bob", rating: 1400, result: "checkmated" },
  };

  it("formats game result", () => {
    expect(formatGameResult(mockGame)).toBe("1-0");
  });

  it("formats resigned results", () => {
    const resigned: ChessComGame = {
      ...mockGame,
      white: { ...mockGame.white, result: "resigned" },
      black: { ...mockGame.black, result: "win" },
    };
    expect(formatGameResult(resigned)).toBe("0-1");
  });

  it("normalizes snake_case API response", () => {
    const normalized = normalizeChessComGame({
      uuid: "x",
      url: "u",
      pgn: "1. e4",
      time_control: "180",
      end_time: 123,
      rated: true,
      white: mockGame.white,
      black: mockGame.black,
    });
    expect(normalized.timeControl).toBe("180");
    expect(formatTimeControl(normalized.timeControl)).toBe("3 min");
  });

  it("formats game title", () => {
    expect(gameTitle(mockGame)).toBe("alice vs bob");
  });
});

describe("game navigation", () => {
  it("returns correct FEN at each ply", () => {
    const game = parsePgn(SAMPLE_PGN);
    expect(fenAtPly(game, 0)).toBe(game.startingFen);
    expect(fenAtPly(game, 3)).toBe(game.moves[2].fen);
  });

  it("builds readable path string", () => {
    const game = parsePgn(SAMPLE_PGN);
    expect(pathToPly(game, 2)).toBe("1. e4 e5");
  });
});

describe("analyze API logic", () => {
  it("returns legal moves from a middlegame position", () => {
    const game = parsePgn(SAMPLE_PGN);
    const fen = game.moves[9].fen;
    const chess = new Chess(fen);
    expect(chess.moves().length).toBeGreaterThan(0);
  });
});
