// Reads a PDF as an ATS does, with pdf.js. Text extraction order is not defined by the PDF format,
// so every page is read in the two orders that pdftotext offers:
// - stream order (pdftotext -raw): text in the order Chrome painted it;
// - layout order (pdftotext -layout): text grouped by baseline, then sorted left to right.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { TextItem } from 'pdfjs-dist/types/src/display/api.js';

// Items less than this apart vertically, in points, share a line.
const BASELINE_TOLERANCE = 1;

export interface PdfPage {
  width: number;
  height: number;
  streamLines: string[];
  layoutLines: string[];
}

export interface PdfFont {
  name: string;
  type: string;
}

export interface PdfText {
  pages: PdfPage[];
  fonts: PdfFont[];
}

const baseline = (item: TextItem) => item.transform[5] ?? 0;
const left = (item: TextItem) => item.transform[4] ?? 0;
const joinText = (items: readonly TextItem[]) => items.map((item) => item.str).join('');

const readStreamLines = (items: readonly TextItem[]) => {
  const lines: TextItem[][] = [];
  let previous: TextItem | undefined;
  for (const item of items) {
    const current = lines.at(-1);
    if (
      !current ||
      !previous ||
      previous.hasEOL ||
      Math.abs(baseline(item) - baseline(previous)) > BASELINE_TOLERANCE
    ) {
      lines.push([item]);
    } else {
      current.push(item);
    }
    previous = item;
  }
  return lines.map(joinText).filter((line) => line.trim());
};

const readLayoutLines = (items: readonly TextItem[]) => {
  const rows: TextItem[][] = [];
  for (const item of [...items].sort((a, b) => baseline(b) - baseline(a))) {
    const row = rows.at(-1);
    if (row && Math.abs(baseline(row[0]!) - baseline(item)) <= BASELINE_TOLERANCE) row.push(item);
    else rows.push([item]);
  }
  return rows.map((row) => joinText(row.sort((a, b) => left(a) - left(b)))).filter((line) => line.trim());
};

export const readPdf = async (data: Uint8Array): Promise<PdfText> => {
  // pdf.js takes ownership of the buffer: it gets a copy.
  const loadingTask = getDocument({ data: data.slice(), fontExtraProperties: true });
  const document = await loadingTask.promise;
  const pages: PdfPage[] = [];
  const fonts = new Map<string, PdfFont>();
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const items = (await page.getTextContent()).items.filter((item): item is TextItem => 'str' in item);
      // Loads the fonts of the page into commonObjs.
      await page.getOperatorList();
      for (const { fontName } of items) {
        const font = page.commonObjs.get(fontName) as PdfFont;
        fonts.set(font.name, { name: font.name, type: font.type });
      }
      const [, , width = 0, height = 0] = page.view;
      pages.push({ width, height, streamLines: readStreamLines(items), layoutLines: readLayoutLines(items) });
    }
  } finally {
    await loadingTask.destroy();
  }
  return { pages, fonts: [...fonts.values()] };
};
