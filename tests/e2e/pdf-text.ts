// Reads a PDF as an ATS does, with pdf.js. Text extraction order is not defined by the PDF format,
// so every page is read in the two orders that pdftotext offers:
// - stream order (pdftotext -raw): text in the order Chrome painted it;
// - layout order (pdftotext -layout): text grouped by baseline, then sorted left to right.
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { TextItem } from 'pdfjs-dist/types/src/display/api.js';

// Items less than this apart vertically, in points, share a line.
const BASELINE_TOLERANCE = 1;

// Unlike pdf.js, Poppler (TextOutputDev.cc) builds words from the glyph positions, as fractions of
// the font size:
// - a gap of more than 0.1 inside a word starts a new word (minWordBreakSpace), which
//   pdftotext -layout reads with a space: "EDUCATIO N";
// - pdftotext -raw only writes a space between two words more than 0.2 apart
//   (minDupBreakOverlap), and reads "DwightK." otherwise.
const MIN_WORD_BREAK_SPACE = 0.1;
const MIN_RAW_WORD_SPACE = 0.2;

export interface PdfPage {
  width: number;
  height: number;
  streamLines: string[];
  layoutLines: string[];
  splitWords: string[];
  mergedWords: string[];
}

interface Glyph {
  text: string;
  x: number;
  width: number;
  fontSize: number;
}

// A pdf.js glyph in the arguments of a showText operation; a number is a TJ position adjustment.
type ShownGlyph = { unicode: string; width: number } | number;

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

const gapAfter = (glyph: Glyph, next: Glyph) => (next.x - (glyph.x + glyph.width)) / glyph.fontSize;
const joinGlyphs = (glyphs: readonly Glyph[]) => glyphs.map((glyph) => glyph.text).join('');

// Chrome writes each run of text on its own line of the text object: words are compared within a line.
const checkLine = (words: readonly Glyph[][], page: Pick<PdfPage, 'splitWords' | 'mergedWords'>) => {
  words.forEach((word, index) => {
    word.slice(1).forEach((glyph, position) => {
      const previous = word[position]!;
      if (glyph.fontSize === previous.fontSize && gapAfter(previous, glyph) > MIN_WORD_BREAK_SPACE) {
        page.splitWords.push(`${joinGlyphs(word)} (${previous.text}|${glyph.text})`);
      }
    });
    const next = words[index + 1];
    if (next && gapAfter(word.at(-1)!, next[0]!) <= MIN_RAW_WORD_SPACE) {
      page.mergedWords.push(`${joinGlyphs(word)} ${joinGlyphs(next)}`);
    }
  });
};

// Follows the text operators: Td (moveText) moves from the start of the current line, and each
// glyph shown advances by its width plus the character spacing (Tc).
const readWords = (fnArray: readonly number[], argsArray: readonly unknown[][]) => {
  const page = { splitWords: [] as string[], mergedWords: [] as string[] };
  let words: Glyph[][] = [[]];
  let fontSize = 0;
  let charSpacing = 0;
  let lineX = 0;
  let x = 0;
  const endLine = () => {
    checkLine(
      words.filter((word) => word.length > 0),
      page,
    );
    words = [[]];
  };
  fnArray.forEach((fn, index) => {
    const args = argsArray[index]!;
    if (fn === OPS.setFont) fontSize = args[1] as number;
    else if (fn === OPS.setCharSpacing) charSpacing = args[0] as number;
    else if (fn === OPS.beginText || fn === OPS.setTextMatrix) {
      endLine();
      lineX = x = 0;
    } else if (fn === OPS.moveText) {
      if (args[1] !== 0) endLine();
      lineX += args[0] as number;
      x = lineX;
    } else if (fn === OPS.showText) {
      for (const glyph of args[0] as ShownGlyph[]) {
        if (typeof glyph === 'number') {
          x -= (glyph / 1000) * fontSize;
          continue;
        }
        const width = (glyph.width / 1000) * fontSize;
        if (/\s/.test(glyph.unicode)) words.push([]);
        else words.at(-1)!.push({ text: glyph.unicode, x, width, fontSize });
        x += width + charSpacing;
      }
    }
  });
  endLine();
  return page;
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
      // Also loads the fonts of the page into commonObjs.
      const { fnArray, argsArray } = await page.getOperatorList();
      for (const { fontName } of items) {
        const font = page.commonObjs.get(fontName) as PdfFont;
        fonts.set(font.name, { name: font.name, type: font.type });
      }
      const [, , width = 0, height = 0] = page.view;
      pages.push({
        width,
        height,
        streamLines: readStreamLines(items),
        layoutLines: readLayoutLines(items),
        ...readWords(fnArray, argsArray as unknown[][]),
      });
    }
  } finally {
    await loadingTask.destroy();
  }
  return { pages, fonts: [...fonts.values()] };
};
