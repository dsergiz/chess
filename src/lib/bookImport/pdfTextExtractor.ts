import { getDocument, VerbosityLevel, type PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface PdfPageText {
  pageNumber: number;
  text: string;
}

// pdfjs-dist's published .d.ts doesn't export TextItem/TextContent by name — derive it from the method that returns it.
type TextContentItem = Awaited<ReturnType<PDFPageProxy["getTextContent"]>>["items"][number];
type TextItem = Extract<TextContentItem, { str: string }>;

function isTextItem(item: TextContentItem): item is TextItem {
  return "str" in item;
}

/** Joins a page's text items into readable lines, using pdf.js's hasEOL hint to preserve line breaks. */
function joinTextItems(items: TextContentItem[]): string {
  let text = "";
  for (const item of items) {
    if (!isTextItem(item)) continue;
    text += item.str;
    text += item.hasEOL ? "\n" : item.str.trim() ? " " : "";
  }
  return text;
}

/** Extracts the embedded text layer of a PDF, page by page. Does not read diagram images. */
export async function extractPdfText(data: Uint8Array): Promise<PdfPageText[]> {
  const loadingTask = getDocument({
    data,
    // Only text extraction is needed; font-metrics warnings for standard fonts are expected noise.
    verbosity: VerbosityLevel.ERRORS,
  });
  const pages: PdfPageText[] = [];

  try {
    const doc = await loadingTask.promise;
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        pages.push({ pageNumber, text: joinTextItems(content.items) });
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await loadingTask.destroy();
  }

  return pages;
}
