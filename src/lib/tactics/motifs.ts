import { Chess, type Square } from "chess.js";

export interface TacticalMotif {
  type: "fork" | "pin" | "skewer" | "discovered" | "check" | "capture";
  description: string;
}

function attacksSquare(chess: Chess, from: Square, target: Square): boolean {
  const moves = chess.moves({ square: from, verbose: true });
  return moves.some((m) => m.to === target);
}

function findPins(chess: Chess, color: "w" | "b"): TacticalMotif[] {
  const motifs: TacticalMotif[] = [];
  const board = chess.board();
  const enemy = color === "w" ? "b" : "w";
  const kingSquare = findKing(board, enemy);
  if (!kingSquare) return motifs;

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (!piece || piece.color !== color) continue;
      const from = coordsToSquare(f, 7 - r);
      if (piece.type === "p" || piece.type === "k") continue;

      const between = lineBetween(from, kingSquare);
      if (between.length === 0) continue;

      const blockers = between.filter((sq) => chess.get(sq));
      if (blockers.length !== 1) continue;

      const blocked = chess.get(blockers[0]!);
      if (!blocked || blocked.color === enemy) continue;

      if (attacksSquare(chess, from, kingSquare)) {
        motifs.push({
          type: "pin",
          description: `The ${piece.type} on ${from} pins the ${blocked.type} on ${blockers[0]} to the king.`,
        });
      }
    }
  }
  return motifs;
}

function findKing(
  board: ReturnType<Chess["board"]>,
  color: "w" | "b"
): Square | null {
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (p?.type === "k" && p.color === color) return coordsToSquare(f, 7 - r);
    }
  }
  return null;
}

function coordsToSquare(f: number, r: number): Square {
  return `${String.fromCharCode(97 + f)}${r + 1}` as Square;
}

function lineBetween(a: Square, b: Square): Square[] {
  const af = a.charCodeAt(0) - 97;
  const ar = parseInt(a[1], 10) - 1;
  const bf = b.charCodeAt(0) - 97;
  const br = parseInt(b[1], 10) - 1;
  const df = Math.sign(bf - af);
  const dr = Math.sign(br - ar);
  if (df === 0 && dr === 0) return [];
  if (af !== bf && ar !== br && Math.abs(bf - af) !== Math.abs(br - ar)) return [];

  const squares: Square[] = [];
  let f = af + df;
  let r = ar + dr;
  while (f !== bf || r !== br) {
    squares.push(coordsToSquare(f, r));
    f += df;
    r += dr;
  }
  return squares;
}

function findForks(chess: Chess, color: "w" | "b"): TacticalMotif[] {
  const motifs: TacticalMotif[] = [];
  const moves = chess.moves({ verbose: true }).filter((m) => m.color === color);

  for (const move of moves) {
    const trial = new Chess(chess.fen());
    trial.move(move);
    const from = move.to as Square;
    const targets: string[] = [];
    const enemy = color === "w" ? "b" : "w";

    for (let r = 1; r <= 8; r++) {
      for (const f of "abcdefgh") {
        const sq = `${f}${r}` as Square;
        const p = trial.get(sq);
        if (p && p.color === enemy && p.type !== "k" && attacksSquare(trial, from, sq)) {
          targets.push(`${p.type} on ${sq}`);
        }
      }
    }

    if (targets.length >= 2) {
      motifs.push({
        type: "fork",
        description: `${move.san} forks ${targets.slice(0, 2).join(" and ")}.`,
      });
    }
  }
  return motifs.slice(0, 2);
}

export function detectTacticalMotifs(fen: string): TacticalMotif[] {
  const chess = new Chess(fen);
  const turn = chess.turn();
  const motifs: TacticalMotif[] = [];

  if (chess.inCheck()) {
    motifs.push({ type: "check", description: "The king is in check — safety is the priority." });
  }

  motifs.push(...findPins(chess, turn));
  motifs.push(...findForks(chess, turn));

  return motifs.slice(0, 4);
}

export function explainBestMoveIdea(
  fen: string,
  bestSan: string,
  pv: string[]
): string {
  const motifs = detectTacticalMotifs(fen);
  const parts: string[] = [];

  if (motifs.length > 0) {
    parts.push(motifs[0].description);
  }

  if (pv.length > 1) {
    try {
      const trial = new Chess(fen);
      const first = pv[0];
      const from = first.slice(0, 2) as Square;
      const to = first.slice(2, 4) as Square;
      const promo = first.length > 4 ? first[4] : undefined;
      trial.move({ from, to, promotion: promo as "q" | "r" | "b" | "n" | undefined });
      const followMotifs = detectTacticalMotifs(trial.fen());
      const fork = followMotifs.find((m) => m.type === "fork");
      if (fork) {
        parts.push(`If ${bestSan}, the follow-up line can ${fork.description.toLowerCase()}`);
      }
    } catch {
      /* ignore invalid PV */
    }
  }

  if (parts.length === 0) {
    parts.push(`${bestSan} improves piece coordination and keeps the initiative.`);
  }

  return parts.join(" ");
}
