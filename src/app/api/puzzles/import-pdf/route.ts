import { NextRequest, NextResponse } from "next/server";
import { extractPdfText } from "@/lib/bookImport/pdfTextExtractor";
import { findMoveListBlocks, stripParenthesizedVariations, type MoveListBlock } from "@/lib/bookImport/moveListExtractor";
import { replaySanTokens } from "@/lib/chess";
import type { ExtractedGameCandidate, PdfExtractionResult, SkippedToken } from "@/types/puzzle";

export const runtime = "nodejs";

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const HEADER_GUESS_LOOKBACK = 400;
const HEADER_LINES_CONSIDERED = 6;
const HEADER_LINE_MAX_LENGTH = 100;
const VS_PATTERN = /\bvs\.?\b|\bv\.\s/i;
const CHAPTER_PATTERN = /^chapter\b/i;

interface PageBoundary {
  pageNumber: number;
  start: number;
}

function pagesForRange(boundaries: PageBoundary[], start: number, end: number): number[] {
  const pages: number[] = [];
  for (let i = 0; i < boundaries.length; i++) {
    const boundaryStart = boundaries[i].start;
    const boundaryEnd = i + 1 < boundaries.length ? boundaries[i + 1].start : Infinity;
    if (boundaryStart < end && boundaryEnd > start) pages.push(boundaries[i].pageNumber);
  }
  return pages.length > 0 ? pages : [boundaries[0]?.pageNumber ?? 1];
}

/**
 * These books typically separate a game's "Player vs Player, Event, Year" header from its move
 * list with a paragraph of scene-setting prose, so the nearest preceding line is usually that
 * prose, not the header. Prefer a "vs"-style header line, then a chapter heading, among the last
 * few preceding lines before falling back to whatever line is closest.
 */
function guessHeader(text: string, blockStart: number): string | undefined {
  const before = text.slice(Math.max(0, blockStart - HEADER_GUESS_LOOKBACK), blockStart);
  const lines = before
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-HEADER_LINES_CONSIDERED);
  if (lines.length === 0) return undefined;

  const vsLine = lines.find((l) => VS_PATTERN.test(l) && l.length <= HEADER_LINE_MAX_LENGTH);
  if (vsLine) return vsLine;

  const chapterLine = lines.find((l) => CHAPTER_PATTERN.test(l) && l.length <= HEADER_LINE_MAX_LENGTH);
  if (chapterLine) return chapterLine;

  const candidate = lines.at(-1);
  return candidate && candidate.length <= HEADER_LINE_MAX_LENGTH ? candidate : undefined;
}

function buildCandidate(block: MoveListBlock, strippedText: string, boundaries: PageBoundary[]): ExtractedGameCandidate {
  const rawTokens = block.tokens.map((t) => t.raw);
  const replay = replaySanTokens(rawTokens);
  const skippedTokens: SkippedToken[] = replay.skipped.map((s) => ({
    token: s.token,
    index: s.index,
    reason: "illegal or unparseable move at this point in the replay",
  }));

  return {
    id: crypto.randomUUID(),
    sourcePages: pagesForRange(boundaries, block.startOffset, block.endOffset),
    headerGuess: guessHeader(strippedText, block.startOffset),
    rawTokens,
    skippedTokens,
    game: replay.game.moves.length > 0 ? replay.game : null,
    startingFen: replay.game.startingFen,
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A PDF file is required" }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
    }
    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: `PDF exceeds the ${MAX_PDF_BYTES / (1024 * 1024)}MB limit` }, { status: 400 });
    }

    const data = new Uint8Array(await file.arrayBuffer());
    const pages = await extractPdfText(data);

    let strippedCombined = "";
    const boundaries: PageBoundary[] = [];
    for (const page of pages) {
      boundaries.push({ pageNumber: page.pageNumber, start: strippedCombined.length });
      strippedCombined += stripParenthesizedVariations(page.text) + "\n";
    }

    const blocks = findMoveListBlocks(strippedCombined);
    const candidates = blocks.map((block) => buildCandidate(block, strippedCombined, boundaries));

    const result: PdfExtractionResult = {
      fileName: file.name,
      pageCount: pages.length,
      pageTexts: pages.map((p) => p.text),
      candidates,
    };

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
