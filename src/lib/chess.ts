import { Chess, type Move, type Square } from "chess.js";
import type {
  GameMove,
  ImportedGame,
  MoveClassification,
  PieceColor,
} from "@/types";

const PIECE_NAMES: Record<string, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

/** Builds a GameMove record from a chess.js Move plus the position right after it was applied. */
function buildGameMove(move: Move, afterMove: Chess, ply: number): GameMove {
  return {
    san: move.san,
    uci: `${move.from}${move.to}${move.promotion ?? ""}`,
    fen: afterMove.fen(),
    ply,
    color: move.color as PieceColor,
    captured: move.captured,
    isCheck: afterMove.inCheck(),
    isCastle: move.flags.includes("k") || move.flags.includes("q"),
    isPromotion: Boolean(move.promotion),
  };
}

/** Deterministic FNV-1a hash so identical pasted PGNs share a stable game id (and cache entry). */
function hashPgn(pgn: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < pgn.length; i++) {
    hash ^= pgn.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `pgn-${(hash >>> 0).toString(16)}`;
}

export function parsePgn(pgn: string, id?: string): ImportedGame {
  const cleaned = sanitizePgn(pgn);
  const chess = new Chess();

  try {
    chess.loadPgn(cleaned, { strict: false });
  } catch {
    throw new Error("Could not parse PGN — check the game format");
  }

  const headers: Record<string, string> = {};
  Object.entries(chess.header()).forEach(([key, value]) => {
    if (value != null) headers[key] = value;
  });

  const replay = new Chess();
  if (headers.FEN) {
    replay.load(headers.FEN);
  }

  const moves: GameMove[] = [];
  const history = chess.history({ verbose: true });

  history.forEach((move, index) => {
    replay.move(move);
    moves.push(buildGameMove(move, replay, index + 1));
  });

  return {
    id: id ?? hashPgn(cleaned),
    pgn,
    headers,
    moves,
    startingFen: headers.FEN ?? new Chess().fen(),
  };
}

export interface SanReplaySkippedToken {
  token: string;
  index: number;
}

export interface SanReplayResult {
  game: ImportedGame;
  skipped: SanReplaySkippedToken[];
}

/**
 * Replays a bare, ordered list of SAN tokens forward from a starting position — for games recovered
 * from book text, which has no PGN headers/movetext framing, only the moves themselves. Illegal or
 * unparseable tokens are recorded in `skipped` and the replay continues from the last good position.
 */
export function replaySanTokens(tokens: string[], startingFen?: string, id?: string): SanReplayResult {
  const chess = startingFen ? new Chess(startingFen) : new Chess();
  const moves: GameMove[] = [];
  const skipped: SanReplaySkippedToken[] = [];
  let ply = 0;

  tokens.forEach((token, index) => {
    let move: Move | null;
    try {
      move = chess.move(token, { strict: false });
    } catch {
      move = null;
    }
    if (!move) {
      skipped.push({ token, index });
      return;
    }
    ply += 1;
    moves.push(buildGameMove(move, chess, ply));
  });

  return {
    game: {
      id: id ?? crypto.randomUUID(),
      pgn: "",
      headers: {},
      moves,
      startingFen: startingFen ?? new Chess().fen(),
    },
    skipped,
  };
}

export function fenAtPly(game: ImportedGame, ply: number): string {
  if (ply <= 0) return game.startingFen;
  const move = game.moves[ply - 1];
  return move?.fen ?? game.startingFen;
}

export function pathToPly(game: ImportedGame, ply: number): string {
  if (ply <= 0) return "Starting position";
  const slice = game.moves.slice(0, ply);
  const pairs: string[] = [];
  for (let i = 0; i < slice.length; i += 2) {
    const moveNum = Math.floor(i / 2) + 1;
    const white = slice[i]?.san ?? "";
    const black = slice[i + 1]?.san ?? "";
    pairs.push(black ? `${moveNum}. ${white} ${black}` : `${moveNum}. ${white}`);
  }
  return pairs.join(" ");
}

export function uciToSan(fen: string, uci: string): string {
  const chess = new Chess(fen);
  const from = uci.slice(0, 2) as Square;
  const to = uci.slice(2, 4) as Square;
  const promotion = uci.length > 4 ? uci[4] : undefined;
  try {
    const move = chess.move({
      from,
      to,
      promotion: promotion as "q" | "r" | "b" | "n" | undefined,
    });
    return move?.san ?? uci;
  } catch {
    return uci;
  }
}

export function classifyMove(evalLoss: number): MoveClassification {
  if (evalLoss <= 0.05) return "best";
  if (evalLoss <= 0.15) return "excellent";
  if (evalLoss <= 0.3) return "good";
  if (evalLoss <= 0.5) return "inaccuracy";
  if (evalLoss <= 1.0) return "mistake";
  if (evalLoss <= 2.0) return "blunder";
  return "blunder";
}

const CLASSIFICATION_PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
/** Opening-theory window: first N plies get "book" instead of "best" if the move was engine-accurate. */
const BOOK_PLY_LIMIT = 10;
/** Don't award "brilliant" once the position is already this lopsided (centipawns) — nothing to prove. */
const BRILLIANT_MAX_EVAL_BEFORE = 400;
/** A moved piece must be worth at least this much to count as a real sacrifice. */
const SACRIFICE_MIN_VALUE = 3;
/** Gap (centipawns) between the best and 2nd-best move that marks a position as sharp/standout. */
const STANDOUT_GAP_CP = 150;

function pieceValueFromSan(san: string): number {
  const letter = san[0];
  if (letter === "K") return CLASSIFICATION_PIECE_VALUES.k;
  if (letter === "Q") return CLASSIFICATION_PIECE_VALUES.q;
  if (letter === "R") return CLASSIFICATION_PIECE_VALUES.r;
  if (letter === "B") return CLASSIFICATION_PIECE_VALUES.b;
  if (letter === "N") return CLASSIFICATION_PIECE_VALUES.n;
  return CLASSIFICATION_PIECE_VALUES.p;
}

/**
 * Layers "book"/"brilliant"/"great"/"miss" on top of `classifyMove`'s eval-loss tier. Heuristic,
 * not authoritative — mirrors the spirit of chess.com/lichess badges using only what's locally
 * computable: material, an attacked-square check via chess.js, and the multiPV gap (best vs.
 * 2nd-best candidate) when the analysis pass collected more than one line.
 */
export function refineClassification(
  base: MoveClassification,
  params: {
    ply: number;
    move: GameMove;
    afterFen: string;
    /** White-POV eval (centipawns) of the position *before* the move. */
    evalBeforeWhite: number;
    /** White-POV candidate moves at the position before the move, ranked best-first. */
    bestMoves?: { uci: string; score: number; mate?: number }[];
  }
): MoveClassification {
  const { ply, move, afterFen, evalBeforeWhite, bestMoves } = params;
  const gapCp =
    bestMoves && bestMoves.length >= 2
      ? Math.abs((bestMoves[0]?.score ?? 0) - (bestMoves[1]?.score ?? 0))
      : undefined;

  if (base === "best") {
    if (Math.abs(evalBeforeWhite) < BRILLIANT_MAX_EVAL_BEFORE) {
      const movedValue = pieceValueFromSan(move.san);
      const capturedValue = move.captured ? (CLASSIFICATION_PIECE_VALUES[move.captured] ?? 0) : 0;
      if (movedValue >= SACRIFICE_MIN_VALUE && movedValue > capturedValue) {
        try {
          const chess = new Chess(afterFen);
          const landedOn = move.uci.slice(2, 4) as Square;
          const opponent = move.color === "w" ? "b" : "w";
          if (chess.isAttacked(landedOn, opponent)) return "brilliant";
        } catch {
          /* malformed square/FEN — fall through to the non-brilliant tiers below */
        }
      }
    }

    if (ply <= BOOK_PLY_LIMIT) return "book";
    if (gapCp !== undefined && gapCp >= STANDOUT_GAP_CP) return "great";
    return "best";
  }

  if ((base === "mistake" || base === "blunder") && gapCp !== undefined && gapCp >= STANDOUT_GAP_CP) {
    return "miss";
  }

  return base;
}

/** UCI scores are from the side to move's perspective — normalize to White's POV. */
export function evalToWhitePerspective(
  score: number,
  mate: number | undefined,
  sideToMove: PieceColor
): { eval: number; mate?: number } {
  if (sideToMove === "w") return { eval: score, mate };
  return { eval: -score, mate: mate !== undefined ? -mate : undefined };
}

export function sideToMoveFromFen(fen: string): PieceColor {
  return fen.includes(" b ") ? "b" : "w";
}

export function formatEval(score: number, mate?: number, perspective: PieceColor = "w"): string {
  if (mate !== undefined) {
    const m = perspective === "w" ? mate : -mate;
    if (m === 0) return "0.00";
    return m > 0 ? `#${m}` : `#${m}`;
  }
  const adjusted = perspective === "w" ? score : -score;
  if (Math.abs(adjusted) >= 9000) {
    return adjusted > 0 ? "M+" : "M−";
  }
  const pawns = adjusted / 100;
  return pawns > 0 ? `+${pawns.toFixed(2)}` : pawns.toFixed(2);
}

export function formatEvalLabel(score: number, mate?: number, perspective: PieceColor = "w"): string {
  if (mate !== undefined) {
    const m = perspective === "w" ? mate : -mate;
    if (m > 0) return m === 1 ? "Mate" : `M${m}`;
    if (m < 0) return m === -1 ? "Mate" : `M${m}`;
    return "Draw";
  }
  return formatEval(score, mate, perspective);
}

/** Centipawn loss for the player who played the move at `ply`. */
export function computeMoveEvalLoss(
  game: ImportedGame,
  ply: number,
  cache: Map<number, { engines: { eval: number; mate?: number; bestMoves: { uci: string; score: number; mate?: number }[] }[] }>,
  evalsAreWhitePov = false
): number | null {
  if (ply <= 0 || ply > game.moves.length) return null;

  const before = cache.get(ply - 1);
  const after = cache.get(ply);
  if (!before?.engines[0] || !after?.engines[0]) return null;

  const move = game.moves[ply - 1];
  const beforeStm = sideToMoveFromFen(fenAtPly(game, ply - 1));

  const beforeWhite = evalsAreWhitePov
    ? { eval: before.engines[0].eval, mate: before.engines[0].mate }
    : evalToWhitePerspective(before.engines[0].eval, before.engines[0].mate, beforeStm);

  const afterWhite = evalsAreWhitePov
    ? { eval: after.engines[0].eval, mate: after.engines[0].mate }
    : evalToWhitePerspective(after.engines[0].eval, after.engines[0].mate, sideToMoveFromFen(fenAtPly(game, ply)));

  let swing =
    move.color === "w"
      ? beforeWhite.eval - afterWhite.eval
      : afterWhite.eval - beforeWhite.eval;

  const best = before.engines[0].bestMoves[0];
  if (best && best.uci !== move.uci) {
    const bestWhite = evalsAreWhitePov
      ? { eval: best.score, mate: best.mate }
      : evalToWhitePerspective(best.score, best.mate, beforeStm);
    const bestSwing =
      move.color === "w"
        ? beforeWhite.eval - bestWhite.eval
        : bestWhite.eval - beforeWhite.eval;
    swing = Math.max(swing, bestSwing);
  }

  return Math.max(0, swing / 100);
}

export function computeClassificationsFromCache(
  game: ImportedGame,
  cache: Map<number, { engines: { eval: number; mate?: number; bestMoves: { uci: string; score: number; mate?: number }[] }[] }>,
  evalsAreWhitePov = false,
  /** Real opening-theory data (Lichess Masters DB) keyed by the fen before the move — when a
   * position isn't covered, classification falls back to refineClassification's ply heuristic. */
  bookMovesByFen?: Map<string, Set<string>>
): Map<number, MoveClassification> {
  const map = new Map<number, MoveClassification>();
  for (let ply = 1; ply <= game.moves.length; ply++) {
    const loss = computeMoveEvalLoss(game, ply, cache, evalsAreWhitePov);
    if (loss === null) continue;

    const base = classifyMove(loss);
    const before = cache.get(ply - 1)?.engines[0];
    const move = game.moves[ply - 1];
    const beforeFen = fenAtPly(game, ply - 1);
    const beforeStm = sideToMoveFromFen(beforeFen);
    const evalBeforeWhite = before
      ? evalsAreWhitePov
        ? before.eval
        : evalToWhitePerspective(before.eval, before.mate, beforeStm).eval
      : 0;

    const isBook = bookMovesByFen?.get(beforeFen)?.has(move.uci) ?? false;

    map.set(
      ply,
      isBook
        ? "book"
        : refineClassification(base, {
            ply,
            move,
            afterFen: move.fen,
            evalBeforeWhite,
            bestMoves: before?.bestMoves,
          })
    );
  }
  return map;
}

export function pieceName(piece: string): string {
  return PIECE_NAMES[piece.toLowerCase()] ?? piece;
}

export function materialCount(fen: string): { white: number; black: number } {
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const board = fen.split(" ")[0];
  let white = 0;
  let black = 0;
  for (const char of board) {
    const lower = char.toLowerCase();
    if (values[lower] !== undefined) {
      if (char === char.toUpperCase()) white += values[lower];
      else black += values[lower];
    }
  }
  return { white, black };
}

export function detectTacticalThemes(fen: string): string[] {
  const chess = new Chess(fen);
  const themes: string[] = [];

  if (chess.inCheck()) themes.push("King in check");
  if (chess.isCheckmate()) themes.push("Checkmate");
  else if (chess.isStalemate()) themes.push("Stalemate");
  else if (chess.isDraw()) themes.push("Drawn position");

  const { white, black } = materialCount(fen);
  const diff = Math.abs(white - black);
  if (diff >= 3) themes.push("Significant material imbalance");
  else if (diff === 0 && white > 0) themes.push("Material equality");

  const moves = chess.moves({ verbose: true });
  const captures = moves.filter((m) => m.captured);
  if (captures.length >= 3) themes.push("Multiple capture opportunities");

  return themes;
}

/** Strip chess.com-specific headers that can confuse replay. */
export function sanitizePgn(pgn: string): string {
  return pgn
    .trim()
    .replace(/^\[CurrentPosition[^\]]*\]\s*$/gm, "")
    .replace(/\{(\[%[^\]]*\])\}/g, "")
    .replace(/\{(\[\d+:\d+\])\}/g, "");
}

/** Rejects malformed FEN and embedded newlines before it reaches a UCI command string sent to the engine worker. */
export function isValidFenForEngine(fen: string): boolean {
  if (!fen || fen.includes("\n") || fen.includes("\r")) return false;
  try {
    new Chess(fen);
    return true;
  } catch {
    return false;
  }
}

export { Chess };
