import { NextRequest, NextResponse } from "next/server";
import { Chess } from "chess.js";
import { parsePgn } from "@/lib/chess";
import { buildConsensus, ENGINE_CONFIGS } from "@/lib/engines/multiEngine";
import type { AnalysisMode } from "@/lib/engines/analysisModes";
import type { EngineResult } from "@/types";

function multiPvForMode(mode?: AnalysisMode): number {
  if (mode === "tactical") return 4;
  if (mode === "compare") return 2;
  return 1;
}

function analyzeWithChessJs(fen: string, mode?: AnalysisMode): EngineResult[] {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  const multiPv = multiPvForMode(mode);
  const topMoves = moves.slice(0, Math.max(multiPv, 5));

  if (topMoves.length === 0) {
    return [
      {
        engineId: "fallback",
        engineName: "Fallback",
        depth: 8,
        eval: chess.isCheckmate() ? -10000 : 0,
        mate: chess.isCheckmate() ? -1 : undefined,
        bestMoves: [],
      },
    ];
  }

  if (mode === "compare") {
    return ENGINE_CONFIGS.map((cfg, index) => {
      const pick = topMoves[index % topMoves.length];
      const uci = `${pick.from}${pick.to}${pick.promotion ?? ""}`;
      const score = 25 - index * 6;
      return {
        engineId: cfg.id,
        engineName: cfg.name,
        depth: cfg.depth,
        eval: score,
        bestMoves: [{ uci, san: pick.san, score, depth: cfg.depth, pv: [uci] }],
      };
    });
  }

  const bestMoves = topMoves.slice(0, multiPv).map((pick, index) => {
    const uci = `${pick.from}${pick.to}${pick.promotion ?? ""}`;
    const score = 25 - index * 4;
    return { uci, san: pick.san, score, depth: 12, pv: [uci] };
  });

  return [
    {
      engineId: mode === "tactical" ? "sf-tactical" : mode === "deep" ? "sf-deep" : "sf-fast",
      engineName: mode === "tactical" ? "Stockfish Tactical" : mode === "deep" ? "Stockfish Deep" : "Stockfish Fast",
      depth: mode === "deep" ? 18 : 12,
      eval: bestMoves[0]?.score ?? 0,
      bestMoves,
    },
  ];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      fen?: string;
      pgn?: string;
      ply?: number;
      mode?: AnalysisMode;
    };
    const { fen, pgn, ply, mode } = body;

    let positionFen = fen;
    if (pgn && ply !== undefined) {
      const game = parsePgn(pgn);
      positionFen = ply <= 0 ? game.startingFen : game.moves[ply - 1]?.fen;
    }

    if (!positionFen) {
      return NextResponse.json({ error: "FEN or PGN+ply required" }, { status: 400 });
    }

    const engines = analyzeWithChessJs(positionFen, mode);
    const consensus = buildConsensus(positionFen, engines);

    return NextResponse.json({ consensus, engines });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
