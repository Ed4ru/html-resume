// Draws text as SVG paths: it looks the same, but adds no text to the PDF, so ATS parsers do not read
// it. An SVG <text>, even in an <img> or a mask, would still be written as text by Chrome.
// Elements marked with DRAWN_ATTRIBUTE get their text nodes replaced by the outlines of their glyphs,
// in the font and style computed by the CSS, which stays the only source of the design.
import { create, type Font } from 'fontkit';
import { DRAWN_ATTRIBUTE, escapeHtml } from './html-fragments.ts';

export type UnicodeRange = readonly [start: number, end: number];

export interface FontDescriptor {
  family: string;
  weight: number;
  style: string;
}

export interface FontFile extends FontDescriptor {
  url: string;
  ranges: readonly UnicodeRange[];
}

export interface TextStyle {
  fontSize: number;
  letterSpacing: number;
  wordSpacing: number;
}

export interface DrawnText {
  // SVG path data, in pixels, with the baseline at y = 0.
  path: string;
  width: number;
  ascent: number;
}

// "U+0000-00FF, U+0131" → [[0x0, 0xff], [0x131, 0x131]]. Wildcards (U+4??) are not used by the fonts.
export const parseUnicodeRange = (value: string): UnicodeRange[] =>
  value
    .split(',')
    .map((part) => part.trim().replace(/^U\+/i, ''))
    .filter(Boolean)
    .map((part) => {
      const [start, end = start] = part.split('-').map((bound) => parseInt(bound!, 16));
      return [start!, end!] as const;
    });

const covers = (ranges: readonly UnicodeRange[], codePoint: number) =>
  ranges.some(([start, end]) => codePoint >= start && codePoint <= end);

// The files of one face: an italic file must never draw upright text, nor the other way round.
export const selectFontFiles = <T extends FontFile>(files: readonly T[], { family, weight, style }: FontDescriptor) =>
  files.filter((file) => file.family === family && file.weight === weight && file.style === style);

// The browser tries the @font-face rules of a family in reverse order: the last rule that covers a
// character draws it.
export const pickFontFile = <T extends FontFile>(files: readonly T[], codePoint: number) =>
  files.findLast((file) => covers(file.ranges, codePoint));

// Splits a text into runs of characters drawn by the same font file, as the browser does with
// unicode-range: kerning does not apply across two files.
export const splitIntoRuns = <T extends FontFile>(files: readonly T[], text: string) => {
  const runs: { file: T; text: string }[] = [];
  for (const character of text) {
    const file = pickFontFile(files, character.codePointAt(0)!);
    if (!file) throw new Error(`No font file covers "${character}" in ${files[0]?.family ?? 'the font'}`);
    const last = runs.at(-1);
    if (last?.file === file) last.text += character;
    else runs.push({ file, text: character });
  }
  return runs;
};

const isSpace = (character: string) => character === ' ' || character === '\u00a0';

// Lays out runs as Chrome does: advances and kerning from the font, letter-spacing after every
// character (the last one included), word-spacing after every space.
export const layoutRuns = (runs: readonly { font: Font; text: string }[], style: TextStyle): DrawnText => {
  let x = 0;
  let ascent = 0;
  let path = '';
  for (const { font, text } of runs) {
    const scale = style.fontSize / font.unitsPerEm;
    ascent = Math.max(ascent, font.ascent * scale);
    const { glyphs, positions } = font.layout(text);
    glyphs.forEach((glyph, index) => {
      if (glyph.id === 0)
        throw new Error(`No glyph for "${String.fromCodePoint(...glyph.codePoints)}" in ${font.familyName}`);
      const position = positions[index]!;
      path += glyph.path
        .scale(scale, -scale)
        .translate(x + position.xOffset * scale, -position.yOffset * scale)
        .toSVG();
      x += position.xAdvance * scale + style.letterSpacing;
      if (glyph.codePoints.some((codePoint) => isSpace(String.fromCodePoint(codePoint)))) x += style.wordSpacing;
    });
  }
  return { path, width: x, ascent };
};

// Paths are rounded to a hundredth of a pixel, well under what a printer or a screen shows.
const roundPath = (path: string) => path.replace(/-?\d*\.\d+/g, (number) => String(Math.round(+number * 100) / 100));

// Chrome paints an <svg> on whole pixels from its top left corner, while text is on whole pixels
// vertically only, at its baseline. With a whole-pixel height and its bottom on the baseline
// (vertical-align: baseline), the SVG rounds like the text vertically; alignPath then moves the
// glyphs back by the horizontal rounding. Without a viewBox, its units stay pixels even when Chrome
// rounds its size. The glyphs below the baseline overflow it.
// data-text keeps the drawn text for the tests, out of the PDF text.
export const renderSvg = ({ path, width, ascent }: DrawnText, text: string) => {
  const height = Math.ceil(ascent);
  // Chrome lays out in 1/64 px and rounds the width of text up, but the width of an SVG down.
  const layoutWidth = Math.ceil(width * 64) / 64;
  return `<svg class="drawn-glyphs" aria-hidden="true" data-text="${escapeHtml(text)}" width="${layoutWidth}" height="${height}" overflow="visible"><path transform="translate(0 ${height})" d="${roundPath(path)}" fill="currentColor"/></svg>`;
};

// The fraction of a pixel Chrome drops when it paints the SVG, measured from the page: the pages are
// at x = 0 in print, but centered on screen.
const alignPath = (svg: SVGSVGElement) => {
  const page = svg.closest('.page') ?? document.body;
  const x = svg.getBoundingClientRect().left - page.getBoundingClientRect().left;
  svg.firstElementChild!.setAttribute('transform', `translate(${x - Math.round(x)} ${svg.getAttribute('height')})`);
};

const listFontFaceRules = (sheet: CSSStyleSheet): CSSFontFaceRule[] =>
  [...sheet.cssRules].flatMap((rule) => {
    if (rule instanceof CSSImportRule) return rule.styleSheet ? listFontFaceRules(rule.styleSheet) : [];
    return rule instanceof CSSFontFaceRule ? [rule] : [];
  });

const unquote = (family: string) => family.trim().replace(/^["']|["']$/g, '');

// The font files declared by the stylesheets of the page, in declaration order.
const listFontFiles = (): FontFile[] =>
  [...document.styleSheets].flatMap(listFontFaceRules).map((rule) => {
    const source = /url\(["']?([^"')]+)["']?\)/.exec(rule.style.getPropertyValue('src'))?.[1];
    if (!source) throw new Error(`@font-face without url(): ${rule.cssText}`);
    const base = rule.parentStyleSheet?.href ?? document.baseURI;
    return {
      family: unquote(rule.style.getPropertyValue('font-family')),
      weight: Number(rule.style.getPropertyValue('font-weight')),
      style: rule.style.getPropertyValue('font-style') || 'normal',
      url: new URL(source, base).href,
      ranges: parseUnicodeRange(rule.style.getPropertyValue('unicode-range') || 'U+0-10FFFF'),
    };
  });

const fonts = new Map<string, Promise<Font>>();

const loadFont = (url: string) => {
  let font = fonts.get(url);
  if (!font) {
    font = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} on ${url}`);
        return response.arrayBuffer();
      })
      .then((buffer) => {
        // fontkit's browser build reads a Uint8Array; its types only name Node's Buffer.
        const loaded = create(new Uint8Array(buffer) as Buffer);
        if (!('layout' in loaded)) throw new Error(`${url} is a font collection`);
        return loaded;
      });
    fonts.set(url, font);
  }
  return font;
};

const transformText = (text: string, transform: string, lang: string) => {
  if (transform === 'uppercase') return text.toLocaleUpperCase(lang);
  if (transform === 'lowercase') return text.toLocaleLowerCase(lang);
  if (transform === 'none') return text;
  throw new Error(`Drawn text does not support text-transform: ${transform}`);
};

const parsePixels = (value: string) => (value === 'normal' ? 0 : parseFloat(value));

const drawTextNode = async (node: Text, files: readonly FontFile[]) => {
  const parent = node.parentElement!;
  const style = getComputedStyle(parent);
  // White space collapses to one space, as it is rendered (white-space: normal).
  const text = transformText(node.data.replace(/\s+/g, ' '), style.textTransform, document.documentElement.lang);
  const face = {
    family: unquote(style.fontFamily.split(',')[0]!),
    weight: Number(style.fontWeight),
    style: style.fontStyle,
  };
  const familyFiles = selectFontFiles(files, face);
  if (familyFiles.length === 0) throw new Error(`No @font-face for ${face.family} ${face.weight} ${face.style}`);

  const runs = await Promise.all(
    splitIntoRuns(familyFiles, text).map(async (run) => ({ font: await loadFont(run.file.url), text: run.text })),
  );
  const fragment = document.createRange().createContextualFragment(
    renderSvg(
      layoutRuns(runs, {
        fontSize: parseFloat(style.fontSize),
        letterSpacing: parsePixels(style.letterSpacing),
        wordSpacing: parsePixels(style.wordSpacing),
      }),
      text,
    ),
  );
  const svg = fragment.firstElementChild as SVGSVGElement;
  node.replaceWith(fragment);
  alignPath(svg);
};

// Text nodes the browser renders: a text node between two blocks, or only made of collapsible white
// space, has no width.
const listRenderedTextNodes = (element: Element) => {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  const range = document.createRange();
  return nodes.filter((node) => {
    range.selectNodeContents(node);
    if (range.getBoundingClientRect().width > 0) return true;
    node.remove();
    return false;
  });
};

export const drawMarkedText = async (root: ParentNode) => {
  const files = listFontFiles();
  const nodes = [...root.querySelectorAll(`[${DRAWN_ATTRIBUTE}]`)].flatMap(listRenderedTextNodes);
  await Promise.all(nodes.map((node) => drawTextNode(node, files)));
};
