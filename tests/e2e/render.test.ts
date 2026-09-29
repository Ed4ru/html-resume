import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import { assertNoFallbackFonts } from '../../scripts/font-check.ts';
import {
  fallbackFontsResume,
  longSidebarResume,
  manyJobsResume,
  resume,
  specialCharactersResume,
} from '../fixtures/resume.ts';
import { openPreview, type Preview } from './preview.ts';

// Same tolerance as src/render/pagination.ts.
const MEASUREMENT_TOLERANCE_PX = 0.5;

// pdftotext -raw only writes a space between two words more than 0.2 times the font size apart
// (minDupBreakOverlap in Poppler's TextOutputDev.cc). Chrome places each glyph at its CSS position,
// while Poppler measures the gap from the end of the glyph itself, without its letter-spacing.
const RAW_WORD_BREAK_SPACE = 0.2;

let preview: Preview;

beforeEach(async () => {
  preview = await openPreview();
});

afterEach(async () => {
  await preview.close();
});

const readPages = () =>
  preview.page.$$eval(
    '#cv .page',
    (pages, tolerance) =>
      pages.map((page) => {
        const main = page.querySelector('.page__main')!;
        const contentBottom = main.getBoundingClientRect().bottom - parseFloat(getComputedStyle(main).paddingBottom);
        const blocks = [...page.querySelector('.page__flow')!.children];
        return {
          overflowingBlocks: blocks.filter((block) => block.getBoundingClientRect().bottom > contentBottom + tolerance)
            .length,
          blockCount: blocks.length,
          endsWithKeptBlock: blocks.at(-1)?.hasAttribute('data-keep-with-next') ?? false,
          pageCount: page.querySelector('.page-count')?.textContent?.trim(),
        };
      }),
    MEASUREMENT_TOLERANCE_PX,
  );

describe('rendering', () => {
  it('renders data/ without errors, warnings or system fonts', async () => {
    expect(preview.errors).toEqual([]);
    expect(preview.warnings).toEqual([]);
    expect((await readPages()).length).toBeGreaterThan(0);
    await expect(assertNoFallbackFonts(preview.page)).resolves.toBeUndefined();
  });

  it('renders another resume in place of data/', async () => {
    await preview.render(resume);
    expect(preview.errors).toEqual([]);
    expect(preview.warnings).toEqual([]);
    expect(await preview.page.$eval('.header__name', (element) => element.textContent)).toBe(resume.name);
    expect(await preview.page.$eval('html', (element) => element.lang)).toBe(resume.lang);
    await expect(assertNoFallbackFonts(preview.page)).resolves.toBeUndefined();
  });

  it('draws accents, quotes and punctuation with the embedded fonts', async () => {
    await preview.render(specialCharactersResume);
    await expect(assertNoFallbackFonts(preview.page)).resolves.toBeUndefined();
  });
});

// Words of the same text node whose space is too narrow for pdftotext -raw, which would merge them.
const findMergedWords = () =>
  preview.page.$eval(
    '#cv',
    (container, threshold) => {
      const merged: string[] = [];
      const measure = (node: Text, index: number) => {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + 1);
        return range.getBoundingClientRect();
      };
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node as Text;
        const style = getComputedStyle(text.parentElement!);
        const fontSize = parseFloat(style.fontSize);
        const letterSpacing = parseFloat(style.letterSpacing) || 0;
        for (const { index } of text.data.matchAll(/(?<=\S) (?=\S)/g)) {
          const before = measure(text, index - 1);
          const after = measure(text, index + 1);
          // The line wraps at this space.
          if (Math.abs(after.top - before.top) > 1) continue;
          if (after.left - before.right + letterSpacing <= threshold * fontSize) {
            merged.push(text.data.slice(Math.max(0, index - 12), index + 13).trim());
          }
        }
      }
      return merged;
    },
    RAW_WORD_BREAK_SPACE,
  );

describe('word spacing', () => {
  it('leaves a space pdftotext -raw reads between the words of data/', async () => {
    expect(await findMergedWords()).toEqual([]);
  });

  it('leaves a space pdftotext -raw reads between the words of the test resume', async () => {
    await preview.render(resume);
    expect(await findMergedWords()).toEqual([]);
  });
});

describe('pagination', () => {
  it('moves whole blocks to the next page and numbers the pages', async () => {
    await preview.render(manyJobsResume);
    const pages = await readPages();

    expect(pages.length).toBeGreaterThanOrEqual(3);
    pages.forEach((page, index) => {
      // A block too tall for an empty page stays alone on it.
      if (page.blockCount > 1) expect(page.overflowingBlocks, `page ${index + 1}`).toBe(0);
      // A section title is never the last block of a page.
      expect(page.endsWithKeptBlock, `page ${index + 1}`).toBe(false);
    });
    expect(pages.map((page) => page.pageCount)).toEqual(
      pages.map((_, index) => (index === 0 ? undefined : `// page ${index + 1}/${pages.length}`)),
    );
  });

  it('keeps every entry', async () => {
    await preview.render(manyJobsResume);
    const entryCount = await preview.page.$$eval('#cv .entry', (entries) => entries.length);
    const { experience, education, projects } = manyJobsResume;
    expect(entryCount).toBe(experience.length + education.length + projects.length);
  });
});

describe('sidebar overflow', () => {
  it('warns in the toolbar and the console', async () => {
    await preview.render(longSidebarResume);
    expect(await preview.page.$eval('.toolbar__name', (element) => element.textContent)).toContain('Sidebar too long');
    expect(preview.warnings).toEqual([expect.stringMatching(/^Sidebar too long by \d/)]);
  });

  it('does not warn when the sidebar fits', async () => {
    await preview.render(resume);
    expect(preview.warnings).toEqual([]);
  });
});

describe('font guard', () => {
  it('names each character drawn with a system font', async () => {
    await preview.render(fallbackFontsResume);
    const error = await assertNoFallbackFonts(preview.page).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(Error);
    const { message } = error as Error;
    expect(message).toContain('"→" (U+2192)');
    expect(message).toContain('"▸" (U+25B8)');
    expect(message).toContain('"🏆" (U+1F3C6)');
  });
});
