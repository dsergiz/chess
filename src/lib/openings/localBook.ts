import { Chess, type Move } from "chess.js";
import type { BookMove } from "@/lib/openingExplorer";

interface TreeNode {
  /** SAN of the move that leads to this node, relative to its parent. */
  san: string;
  totalGames: number;
  whitePct: number;
  drawPct: number;
  blackPct: number;
  children?: TreeNode[];
}

/**
 * Hand-curated master-game frequencies for the most common opening lines (approximate — not
 * pulled live). Serves as an instant, offline-capable book: `fetchOpeningBook` checks the
 * IndexedDB cache first, then this tree, before paying for a Lichess Masters API round trip.
 */
const OPENING_TREE: TreeNode[] = [
  {
    san: "e4", totalGames: 520000, whitePct: 37, drawPct: 32, blackPct: 31,
    children: [
      { san: "c5", totalGames: 155000, whitePct: 36, drawPct: 33, blackPct: 31, children: [
        { san: "Nf3", totalGames: 100000, whitePct: 36, drawPct: 32, blackPct: 32, children: [
          { san: "d6", totalGames: 40000, whitePct: 35, drawPct: 33, blackPct: 32, children: [
            { san: "d4", totalGames: 38000, whitePct: 35, drawPct: 33, blackPct: 32, children: [
              { san: "cxd4", totalGames: 37000, whitePct: 35, drawPct: 33, blackPct: 32, children: [
                { san: "Nxd4", totalGames: 36000, whitePct: 35, drawPct: 33, blackPct: 32, children: [
                  { san: "Nf6", totalGames: 30000, whitePct: 36, drawPct: 32, blackPct: 32, children: [
                    { san: "Nc3", totalGames: 29000, whitePct: 36, drawPct: 32, blackPct: 32, children: [
                      { san: "a6", totalGames: 20000, whitePct: 37, drawPct: 31, blackPct: 32 }, // Najdorf
                    ] },
                  ] },
                ] },
              ] },
            ] },
          ] },
          { san: "Nc6", totalGames: 35000, whitePct: 36, drawPct: 32, blackPct: 32 },
          { san: "e6", totalGames: 20000, whitePct: 35, drawPct: 33, blackPct: 32 },
        ] },
      ] },
      { san: "e5", totalGames: 140000, whitePct: 38, drawPct: 33, blackPct: 29, children: [
        { san: "Nf3", totalGames: 130000, whitePct: 38, drawPct: 33, blackPct: 29, children: [
          { san: "Nc6", totalGames: 115000, whitePct: 38, drawPct: 33, blackPct: 29, children: [
            { san: "Bb5", totalGames: 60000, whitePct: 39, drawPct: 33, blackPct: 28, children: [ // Ruy Lopez
              { san: "a6", totalGames: 45000, whitePct: 39, drawPct: 33, blackPct: 28, children: [
                { san: "Ba4", totalGames: 40000, whitePct: 39, drawPct: 33, blackPct: 28, children: [
                  { san: "Nf6", totalGames: 35000, whitePct: 38, drawPct: 34, blackPct: 28 },
                ] },
                { san: "Bxc6", totalGames: 5000, whitePct: 35, drawPct: 34, blackPct: 31 }, // Exchange Ruy
              ] },
              { san: "Nf6", totalGames: 12000, whitePct: 35, drawPct: 38, blackPct: 27 }, // Berlin
            ] },
            { san: "Bc4", totalGames: 35000, whitePct: 37, drawPct: 33, blackPct: 30 }, // Italian
            { san: "d4", totalGames: 15000, whitePct: 36, drawPct: 34, blackPct: 30 }, // Scotch
          ] },
          { san: "Nf6", totalGames: 10000, whitePct: 33, drawPct: 38, blackPct: 29 }, // Petrov
        ] },
      ] },
      { san: "e6", totalGames: 55000, whitePct: 35, drawPct: 37, blackPct: 28, children: [ // French
        { san: "d4", totalGames: 50000, whitePct: 35, drawPct: 37, blackPct: 28, children: [
          { san: "d5", totalGames: 48000, whitePct: 35, drawPct: 37, blackPct: 28, children: [
            { san: "Nc3", totalGames: 20000, whitePct: 35, drawPct: 37, blackPct: 28 },
            { san: "Nd2", totalGames: 15000, whitePct: 34, drawPct: 38, blackPct: 28 },
            { san: "e5", totalGames: 8000, whitePct: 36, drawPct: 36, blackPct: 28 },
          ] },
        ] },
      ] },
      { san: "c6", totalGames: 48000, whitePct: 34, drawPct: 37, blackPct: 29, children: [ // Caro-Kann
        { san: "d4", totalGames: 44000, whitePct: 34, drawPct: 37, blackPct: 29, children: [
          { san: "d5", totalGames: 42000, whitePct: 34, drawPct: 37, blackPct: 29, children: [
            { san: "Nc3", totalGames: 15000, whitePct: 34, drawPct: 37, blackPct: 29 },
            { san: "e5", totalGames: 10000, whitePct: 35, drawPct: 36, blackPct: 29 },
          ] },
        ] },
      ] },
    ],
  },
  {
    san: "d4", totalGames: 410000, whitePct: 36, drawPct: 35, blackPct: 29,
    children: [
      { san: "Nf6", totalGames: 190000, whitePct: 34, drawPct: 36, blackPct: 30, children: [
        { san: "c4", totalGames: 160000, whitePct: 34, drawPct: 36, blackPct: 30, children: [
          { san: "e6", totalGames: 70000, whitePct: 34, drawPct: 36, blackPct: 30, children: [
            { san: "Nc3", totalGames: 40000, whitePct: 34, drawPct: 37, blackPct: 29, children: [
              { san: "Bb4", totalGames: 25000, whitePct: 34, drawPct: 37, blackPct: 29 }, // Nimzo-Indian
            ] },
          ] },
          { san: "g6", totalGames: 60000, whitePct: 33, drawPct: 37, blackPct: 30, children: [
            { san: "Nc3", totalGames: 35000, whitePct: 33, drawPct: 37, blackPct: 30, children: [
              { san: "Bg7", totalGames: 18000, whitePct: 33, drawPct: 37, blackPct: 30 }, // King's Indian
              { san: "d5", totalGames: 15000, whitePct: 33, drawPct: 37, blackPct: 30 }, // Grünfeld
            ] },
          ] },
        ] },
      ] },
      { san: "d5", totalGames: 150000, whitePct: 35, drawPct: 36, blackPct: 29, children: [
        { san: "c4", totalGames: 90000, whitePct: 35, drawPct: 37, blackPct: 28, children: [
          { san: "e6", totalGames: 45000, whitePct: 34, drawPct: 38, blackPct: 28 }, // QGD
          { san: "c6", totalGames: 40000, whitePct: 36, drawPct: 36, blackPct: 28 }, // Slav
          { san: "dxc4", totalGames: 5000, whitePct: 33, drawPct: 38, blackPct: 29 }, // QGA
        ] },
      ] },
      { san: "e6", totalGames: 20000, whitePct: 33, drawPct: 37, blackPct: 30 },
      { san: "f5", totalGames: 8000, whitePct: 32, drawPct: 36, blackPct: 32 }, // Dutch
    ],
  },
  {
    san: "Nf3", totalGames: 95000, whitePct: 35, drawPct: 34, blackPct: 31,
    children: [
      { san: "d5", totalGames: 30000, whitePct: 35, drawPct: 34, blackPct: 31 },
      { san: "Nf6", totalGames: 28000, whitePct: 34, drawPct: 35, blackPct: 31 },
      { san: "c5", totalGames: 15000, whitePct: 35, drawPct: 34, blackPct: 31 },
    ],
  },
  {
    san: "c4", totalGames: 88000, whitePct: 34, drawPct: 36, blackPct: 30,
    children: [
      { san: "e5", totalGames: 25000, whitePct: 33, drawPct: 36, blackPct: 31 },
      { san: "Nf6", totalGames: 24000, whitePct: 34, drawPct: 35, blackPct: 31 },
      { san: "c5", totalGames: 12000, whitePct: 34, drawPct: 35, blackPct: 31 },
    ],
  },
];

function buildIndex(): Map<string, BookMove[]> {
  const index = new Map<string, BookMove[]>();

  function walk(chess: Chess, siblings: TreeNode[]) {
    const parentFen = chess.fen();
    const bookMoves: BookMove[] = [];

    for (const node of siblings) {
      let move: Move | null;
      try {
        move = chess.move(node.san);
      } catch {
        move = null;
      }
      if (!move) continue;

      bookMoves.push({
        uci: `${move.from}${move.to}${move.promotion ?? ""}`,
        san: move.san,
        whitePct: node.whitePct,
        drawPct: node.drawPct,
        blackPct: node.blackPct,
        totalGames: node.totalGames,
      });
      if (node.children) walk(chess, node.children);
      chess.undo();
    }

    if (bookMoves.length > 0) index.set(parentFen, bookMoves);
  }

  walk(new Chess(), OPENING_TREE);
  return index;
}

let cachedIndex: Map<string, BookMove[]> | null = null;

export function localBookMoves(fen: string): BookMove[] {
  if (!cachedIndex) cachedIndex = buildIndex();
  return cachedIndex.get(fen) ?? [];
}
