export interface ModelGame {
  id: string;
  eco: string;
  opening: string;
  white: string;
  black: string;
  event: string;
  year: number;
  result: string;
  lesson: string;
  lichessUrl: string;
  uciPrefix: string[];
}

/** Curated master games for learning — matched by opening move prefix. */
export const MODEL_GAMES: ModelGame[] = [
  {
    id: "morphy-opera",
    eco: "C41",
    opening: "Philidor Defense",
    white: "Morphy",
    black: "Duke of Brunswick",
    event: "Opera Game",
    year: 1858,
    result: "1-0",
    lesson: "Rapid development and open lines punish passive defense.",
    lichessUrl: "https://lichess.org/study/Qpotter",
    uciPrefix: ["e2e4", "e7e5", "g1f3", "d7d6"],
  },
  {
    id: "fischer-game-of-century",
    eco: "D06",
    opening: "Grünfeld Defense",
    white: "Donald Byrne",
    black: "Bobby Fischer",
    event: "Rosenwald Memorial",
    year: 1956,
    result: "0-1",
    lesson: "Sacrifices that open diagonals toward the king can be worth a full piece.",
    lichessUrl: "https://lichess.org/1m0vpEvO",
    uciPrefix: ["g1f3", "g8f6", "c2c4", "g7g6"],
  },
  {
    id: "kasparov-immortal",
    eco: "B06",
    opening: "Modern Defense",
    white: "Garry Kasparov",
    black: "Veselin Topalov",
    event: "Wijk aan Zee",
    year: 1999,
    result: "1-0",
    lesson: "A king hunt with rook lifts and quiet intermediate moves.",
    lichessUrl: "https://lichess.org/VjQ8N5YW",
    uciPrefix: ["e2e4", "d7d6", "d2d4", "g7g6"],
  },
  {
    id: "caruana-nakamura",
    eco: "C50",
    opening: "Italian Game",
    white: "Fabiano Caruana",
    black: "Hikaru Nakamura",
    event: "Sinquefield Cup",
    year: 2018,
    result: "1/2-1/2",
    lesson: "Italian structures: fight for the d4 square and piece activity.",
    lichessUrl: "https://lichess.org/analysis/standard/italian-game",
    uciPrefix: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4"],
  },
  {
    id: "sicilian-najdorf",
    eco: "B90",
    opening: "Sicilian Defense, Najdorf",
    white: "Anatoly Karpov",
    black: "Garry Kasparov",
    event: "World Championship",
    year: 1985,
    result: "0-1",
    lesson: "Opposite-side castling in the Najdorf — pawn storms decide.",
    lichessUrl: "https://lichess.org/analysis/standard/sicilian-defense-najdorf-variation",
    uciPrefix: ["e2e4", "c7c5", "g1f3", "d7d6", "d2d4", "c5d4", "f3d4", "g8f6", "b1c3", "a7a6"],
  },
];

export function suggestModelGames(uciMoves: string[], eco?: string, limit = 3): ModelGame[] {
  const scored = MODEL_GAMES.map((game) => {
    let prefixMatch = 0;
    for (let i = 0; i < game.uciPrefix.length; i++) {
      if (uciMoves[i] === game.uciPrefix[i]) prefixMatch++;
      else break;
    }
    const ecoMatch = eco && game.eco.startsWith(eco.slice(0, 1)) ? 1 : 0;
    return { game, score: prefixMatch * 10 + ecoMatch + (prefixMatch === game.uciPrefix.length ? 5 : 0) };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.game);
}
