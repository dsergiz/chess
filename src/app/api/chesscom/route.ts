import { NextRequest, NextResponse } from "next/server";
import { fetchRecentGames } from "@/lib/chesscom";

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username");
  const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10);

  if (!username?.trim()) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  try {
    const games = await fetchRecentGames(username.trim(), Math.min(limit, 50));
    return NextResponse.json({ games });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch games";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
