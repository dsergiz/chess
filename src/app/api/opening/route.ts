import { NextRequest, NextResponse } from "next/server";
import { parseExplorerMoves } from "@/lib/openingExplorer";
import { localBookMoves } from "@/lib/openings/localBook";

function explorerHeaders(): HeadersInit {
  const token = process.env.LICHESS_API_TOKEN;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function GET(request: NextRequest) {
  const fen = request.nextUrl.searchParams.get("fen");
  if (!fen) {
    return NextResponse.json({ error: "Missing fen parameter" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://explorer.lichess.ovh/masters?fen=${encodeURIComponent(fen)}`,
      { headers: explorerHeaders(), next: { revalidate: 3600 } }
    );
    if (!res.ok) {
      return NextResponse.json({ moves: localBookMoves(fen) }, { status: 200 });
    }
    const data = await res.json();
    const moves = parseExplorerMoves(data);
    if (moves.length === 0) {
      return NextResponse.json({ ...data, moves: localBookMoves(fen) });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ moves: localBookMoves(fen) }, { status: 200 });
  }
}
