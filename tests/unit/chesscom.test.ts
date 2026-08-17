import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchRecentGames } from "@/lib/chesscom";

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response;
}

describe("fetchRecentGames", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("skips an archive that 404s (e.g. an unpopulated current-month archive) and keeps trying older ones", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/archives")) {
        return jsonResponse({
          archives: [
            "https://api.chess.com/pub/player/x/games/2026/07",
            "https://api.chess.com/pub/player/x/games/2026/08",
          ],
        });
      }
      if (url.endsWith("/2026/08")) {
        return jsonResponse({ code: 0, message: "not found" }, false, 404);
      }
      if (url.endsWith("/2026/07")) {
        return jsonResponse({
          games: [
            {
              uuid: "g1",
              url: "https://chess.com/g1",
              pgn: "1. e4 e5",
              time_control: "600",
              end_time: 1,
              rated: true,
              white: { username: "a", rating: 1500, result: "win" },
              black: { username: "b", rating: 1500, result: "checkmated" },
            },
          ],
        });
      }
      throw new Error(`unexpected url ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const games = await fetchRecentGames("x", 10);
    expect(games).toHaveLength(1);
    expect(games[0].uuid).toBe("g1");
  });

  it("throws only when every archive fails", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/archives")) {
        return jsonResponse({ archives: ["https://api.chess.com/pub/player/x/games/2026/08"] });
      }
      return jsonResponse({}, false, 404);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(fetchRecentGames("x", 10)).rejects.toThrow();
  });
});
