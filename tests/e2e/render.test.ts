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
