import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST as analyzePost } from "@/app/api/analyze/route";

describe("POST /api/analyze", () => {
  it("returns consensus for a valid FEN", async () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const req = new NextRequest("http://localhost/api/analyze", {
      method: "POST",
      body: JSON.stringify({ fen }),
    });

    const res = await analyzePost(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.consensus).toBeDefined();
    expect(data.consensus.engines.length).toBe(1);
    expect(data.consensus.consensusMove).toBeTruthy();
  });

  it("returns multiple lines for tactical mode", async () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const req = new NextRequest("http://localhost/api/analyze", {
      method: "POST",
      body: JSON.stringify({ fen, mode: "tactical" }),
    });

    const res = await analyzePost(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.consensus.engines[0].bestMoves.length).toBeGreaterThan(1);
  });

  it("returns compare consensus with multiple engines", async () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const req = new NextRequest("http://localhost/api/analyze", {
      method: "POST",
      body: JSON.stringify({ fen, mode: "compare" }),
    });

    const res = await analyzePost(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.consensus.engines.length).toBe(3);
  });

  it("returns 400 when FEN is missing", async () => {
    const req = new NextRequest("http://localhost/api/analyze", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = await analyzePost(req);
    expect(res.status).toBe(400);
  });

  it("accepts PGN and ply", async () => {
    const pgn = `[Event "T"]\n[White "A"]\n[Black "B"]\n\n1. e4 e5 *`;
    const req = new NextRequest("http://localhost/api/analyze", {
      method: "POST",
      body: JSON.stringify({ pgn, ply: 1 }),
    });

    const res = await analyzePost(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.consensus.fen).toContain("4P3");
  });
});
