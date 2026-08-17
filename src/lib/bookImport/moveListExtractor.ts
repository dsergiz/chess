export interface MoveToken {
  raw: string;
  offset: number;
}

export interface MoveListBlock {
  tokens: MoveToken[];
  startOffset: number;
  endOffset: number;
}

const SAN_TOKEN_SOURCE =
  "O-O-O|O-O|0-0-0|0-0|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?";
const SAN_TOKEN_RE = new RegExp(`^(?:${SAN_TOKEN_SOURCE})`);
/** Move-number anchor, e.g. "23." (full move) or "23..." (black-to-move continuation, 3 dots total). */
const MOVE_ANCHOR_RE = /(\d{1,3})\.(\.\.)?/g;
/** How close a candidate black reply must be after white's move to be grabbed without its own anchor. */
const ADJACENT_REPLY_WINDOW = 8;

/**
 * Strips parenthesized sideline variations, nesting-aware. These books quote alternative lines in
 * parens; the puzzle pipeline is forward-only over the game actually played, so sidelines are dropped
 * rather than reconstructed.
 */
export function stripParenthesizedVariations(text: string): string {
  let result = "";
  let depth = 0;
  for (const char of text) {
    if (char === "(") {
      depth++;
      continue;
    }
    if (char === ")") {
      if (depth > 0) depth--;
      continue;
    }
    if (depth === 0) result += char;
  }
  return result;
}

function matchSanTokenAt(text: string, offset: number): string | null {
  const rest = text.slice(offset);
  const match = SAN_TOKEN_RE.exec(rest);
  if (!match || !match[0]) return null;
  return match[0];
}

/**
 * Heuristically finds runs of chess movetext in book prose. Not a strict parser — chess.js legality
 * during replay is the real validator; this just narrows down candidate spans of text to replay.
 */
export function findMoveListBlocks(text: string): MoveListBlock[] {
  const blocks: MoveListBlock[] = [];
  let current: MoveListBlock | null = null;
  let lastNum = 0;

  MOVE_ANCHOR_RE.lastIndex = 0;
  let anchorMatch: RegExpExecArray | null;

  while ((anchorMatch = MOVE_ANCHOR_RE.exec(text)) !== null) {
    const num = Number(anchorMatch[1]);
    const isBlackContinuation = Boolean(anchorMatch[2]);
    const anchorEnd = anchorMatch.index + anchorMatch[0].length;

    const firstTokenOffset = skipWhitespace(text, anchorEnd);
    const firstToken = matchSanTokenAt(text, firstTokenOffset);
    if (!firstToken) continue; // not a real move number (date, page number, footnote, ...)

    const isSequential = num === lastNum || num === lastNum + 1;
    if (!current || !isSequential) {
      if (current) blocks.push(current);
      current = { tokens: [], startOffset: anchorMatch.index, endOffset: anchorEnd };
    }
    lastNum = num;

    current.tokens.push({ raw: firstToken, offset: firstTokenOffset });
    let cursor = firstTokenOffset + firstToken.length;
    current.endOffset = cursor;

    // A full move number ("23.") is immediately followed by black's reply too, when adjacent
    // in the text — a large gap means the book will re-anchor black's move with its own "N...".
    if (!isBlackContinuation) {
      const afterWhite = skipWhitespace(text, cursor);
      if (afterWhite - cursor <= ADJACENT_REPLY_WINDOW) {
        const secondToken = matchSanTokenAt(text, afterWhite);
        if (secondToken && !isAnotherAnchorAt(text, afterWhite)) {
          current.tokens.push({ raw: secondToken, offset: afterWhite });
          cursor = afterWhite + secondToken.length;
          current.endOffset = cursor;
        }
      }
    }
  }

  if (current) blocks.push(current);
  return blocks;
}

function skipWhitespace(text: string, offset: number): number {
  let i = offset;
  while (i < text.length && /\s/.test(text[i])) i++;
  return i;
}

const LOCAL_ANCHOR_START_RE = /^\d{1,3}\.(\.\.)?/;

function isAnotherAnchorAt(text: string, offset: number): boolean {
  return LOCAL_ANCHOR_START_RE.test(text.slice(offset));
}

/**
 * Extension point for a future vision/OCR pass over diagram-only pages (no source game to replay
 * forward through). Not implemented — diagrams are out of scope for this phase.
 */
export async function extractMovesFromDiagramImage(_pageImage: unknown): Promise<string[] | null> {
  return null;
}
