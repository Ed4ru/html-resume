import { readFileSync } from 'node:fs';
import { create, type Font } from 'fontkit';
import { describe, expect, it } from 'vite-plus/test';
import { type FontFile, layoutRuns, parseUnicodeRange, pickFontFile, renderSvg, splitIntoRuns } from './drawn-text.ts';

const loadFont = (file: string) => create(readFileSync(new URL(`../../assets/fonts/${file}`, import.meta.url))) as Font;

const fontFile = (url: string, range: string): FontFile => ({
  family: 'Geist',
  weight: 400,
  url,
  ranges: parseUnicodeRange(range),
});

// Declared in this order in styles/fonts.css: latin-ext, then latin.
const FILES = [fontFile('latin-ext', 'U+0100-02BA, U+0304'), fontFile('latin', 'U+0000-00FF, U+0304')];

describe('parseUnicodeRange', () => {
  it('reads single code points and ranges', () => {
    expect(parseUnicodeRange('U+0000-00FF, U+0131,U+2000-206F')).toEqual([
      [0x0, 0xff],
      [0x131, 0x131],
      [0x2000, 0x206f],
    ]);
  });
});

describe('pickFontFile', () => {
  it('takes the last file that covers the character, as the browser does', () => {
    expect(pickFontFile(FILES, 'a'.codePointAt(0)!)?.url).toBe('latin');
    expect(pickFontFile(FILES, 'ő'.codePointAt(0)!)?.url).toBe('latin-ext');
    expect(pickFontFile(FILES, 0x304)?.url).toBe('latin');
  });
});

describe('splitIntoRuns', () => {
  it('splits the text where the font file changes', () => {
    expect(splitIntoRuns(FILES, 'Łódź').map((run) => [run.file.url, run.text])).toEqual([
      ['latin-ext', 'Ł'],
      ['latin', 'ód'],
      ['latin-ext', 'ź'],
    ]);
  });

  it('fails on a character no file covers', () => {
    expect(() => splitIntoRuns(FILES, 'a→b')).toThrow('No font file covers "→" in Geist');
  });
});

describe('layoutRuns', () => {
  const bold = loadFont('geist-latin-700.woff2');

  it('lays out the text as wide as Chrome draws it', () => {
    // Measured in Chrome: a section title, 12px, letter-spacing 0.08em.
    const { width } = layoutRuns([{ font: bold, text: 'EXPÉRIENCE PROFESSIONNELLE' }], {
      fontSize: 12,
      letterSpacing: 0.96,
      wordSpacing: 0,
    });
    expect(width).toBeCloseTo(217.92, 1);
  });

  it('adds word-spacing after each space', () => {
    const style = { fontSize: 12, letterSpacing: 0, wordSpacing: 0 };
    const spaced = layoutRuns([{ font: bold, text: 'A B C' }], { ...style, wordSpacing: 3 });
    expect(spaced.width - layoutRuns([{ font: bold, text: 'A B C' }], style).width).toBeCloseTo(6);
  });

  it('fails on a character the font has no glyph for', () => {
    expect(() => layoutRuns([{ font: bold, text: 'a✓b' }], { fontSize: 12, letterSpacing: 0, wordSpacing: 0 })).toThrow(
      'No glyph for "✓"',
    );
  });
});

describe('renderSvg', () => {
  it('rounds the height up to whole pixels, the width up to 1/64 px, and keeps pixel units', () => {
    const svg = renderSvg({ path: 'M0.123456 1L2 3Z', width: 21.6, ascent: 9.24 }, '// page <2>');
    expect(svg).toContain('width="21.609375" height="10"');
    expect(svg).not.toContain('viewBox');
    expect(svg).toContain('aria-hidden="true" data-text="// page &lt;2&gt;"');
    expect(svg).toContain('d="M0.12 1L2 3Z"');
  });
});
