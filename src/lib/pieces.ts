/** Chess.com neo piece set — reliable CDN used by chess.com itself. */
const PIECE_FILES: Record<string, string> = {
  wP: "wp",
  wN: "wn",
  wB: "wb",
  wR: "wr",
  wQ: "wq",
  wK: "wk",
  bP: "bp",
  bN: "bn",
  bB: "bb",
  bR: "br",
  bQ: "bq",
  bK: "bk",
};

export function pieceImageUrl(piece: keyof typeof PIECE_FILES): string {
  const file = PIECE_FILES[piece];
  return `/pieces/neo/${file}.png`;
}

export const BOARD_LIGHT = "#ebecd0";
export const BOARD_DARK = "#779556";
export const BOARD_LAST_MOVE = "rgba(255, 255, 0, 0.35)";
export const BOARD_BEST_FROM = "rgba(20, 85, 30, 0.55)";
export const BOARD_BEST_TO = "rgba(20, 85, 30, 0.75)";
