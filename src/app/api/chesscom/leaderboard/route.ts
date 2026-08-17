import { NextResponse } from "next/server";
import { fetchTopPlayers } from "@/lib/chesscom";

export async function GET() {
  try {
    const players = await fetchTopPlayers(10);
    return NextResponse.json({ players });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch leaderboard";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
