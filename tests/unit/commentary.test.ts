import { describe, it, expect } from "vitest";
import { parsePgn } from "@/lib/chess";
import { buildConsensus } from "@/lib/engines/multiEngine";
import { generatePositionCommentary } from "@/lib/commentary/generator";
import type { EngineResult } from "@/types";

const SAMPLE_PGN = `[Event "Test"]
[White "Alice"]
[Black "Bob"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 1-0`;

describe("generatePositionCommentary", () => {
  it("uses consensus.fen for tactical themes not stale ply", () => {
    const game = parsePgn(SAMPLE_PGN);
    const afterE4 = game.moves[0].fen;
    const engines: EngineResult[] = [
      {
        engineId: "a",
        engineName: "Stockfish Fast",
        depth: 12,
        eval: 25,
        bestMoves: [{ uci: "g1f3", san: "Nf3", score: 25, depth: 12, pv: ["g1f3"] }],
      },
    ];
    const consensus = buildConsensus(afterE4, engines);
    const commentary = generatePositionCommentary(game, 1, consensus);

    expect(consensus.fen).toContain("4P3");
    expect(commentary.pathToPosition).toContain("1. e4");
    expect(commentary.summary.toLowerCase()).toMatch(/better|worse|equal/);
  });

  it("labels explored variations", () => {
    const game = parsePgn(SAMPLE_PGN);
    const fen = game.moves[2].fen;
    const engines: EngineResult[] = [
      {
        engineId: "a",
        engineName: "Stockfish Fast",
        depth: 12,
        eval: 10,
        bestMoves: [{ uci: "d2d4", san: "d4", score: 10, depth: 12, pv: ["d2d4"] }],
      },
    ];
    const consensus = buildConsensus(fen, engines);
    const commentary = generatePositionCommentary(game, 3, consensus, { isVariation: true });

    expect(commentary.pathToPosition).toContain("Variation");
  });
});
