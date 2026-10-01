import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import { assertNoFallbackFonts } from '../../scripts/font-check.ts';
import {
  fallbackFontsResume,
  LONG_JOB_BULLETS,
  longJobResume,
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
          // List items of the first block, when it is the rest of an entry split on the previous page.
          continuedItemCount: blocks[0]?.classList.contains('entry--continued')
            ? blocks[0].querySelectorAll('.bullets__item').length
            : undefined,
          lastBlockItemCount: blocks.at(-1)!.querySelectorAll('.bullets__item').length,
          pageCount: page.querySelector('.page-count')?.textContent?.trim(),
        };
      }),
    MEASUREMENT_TOLERANCE_PX,
  );

describe('rendering', () => {
  it('renders the example data without errors, warnings or system fonts', async () => {
    expect(preview.errors).toEqual([]);
    expect(preview.warnings).toEqual([]);
    expect((await readPages()).length).toBeGreaterThan(0);
    await expect(assertNoFallbackFonts(preview.page)).resolves.toBeUndefined();
  });

  it('renders another resume in place of the example data', async () => {
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

const expectPagesToFit = (pages: Awaited<ReturnType<typeof readPages>>) => {
  pages.forEach((page, index) => {
    // A block too tall for an empty page, and not splittable, stays alone on it.
    if (page.blockCount > 1) expect(page.overflowingBlocks, `page ${index + 1}`).toBe(0);
    // A section title is never the last block of a page.
    expect(page.endsWithKeptBlock, `page ${index + 1}`).toBe(false);
    // A split entry keeps at least one item with its head and carries at least two.
    if (page.continuedItemCount !== undefined) {
      expect(page.continuedItemCount, `page ${index + 1}`).toBeGreaterThanOrEqual(2);
      expect(pages[index - 1]!.lastBlockItemCount, `page ${index}`).toBeGreaterThanOrEqual(1);
    }
  });
};

describe('pagination', () => {
  it('fills the pages without overflowing them and numbers the pages', async () => {
    await preview.render(manyJobsResume);
    const pages = await readPages();

    expect(pages.length).toBeGreaterThanOrEqual(3);
    expectPagesToFit(pages);
    expect(pages.map((page) => page.pageCount)).toEqual(
      pages.map((_, index) => (index === 0 ? undefined : `// page ${index + 1}/${pages.length}`)),
    );
  });

  it('keeps every entry', async () => {
    await preview.render(manyJobsResume);
    const entryCount = await preview.page.$$eval('#cv .entry:not(.entry--continued)', (entries) => entries.length);
    const { experience, education, projects } = manyJobsResume;
    expect(entryCount).toBe(experience.length + education.length + projects.length);
  });

  it('splits an entry between its list items, over as many pages as needed', async () => {
    await preview.render(longJobResume);
    const pages = await readPages();
    const fragments = await preview.page.$$eval('#cv .entry', (entries) =>
      entries
        .filter(
          (entry) =>
            entry.querySelector('.entry__title')?.textContent === 'Regional Manager' ||
            entry.classList.contains('entry--continued'),
        )
        .map((entry) => ({
          hasHead: entry.querySelector('.entry__head') !== null,
          hasTags: entry.querySelector('.tags') !== null,
          items: [...entry.querySelectorAll('.bullets__item')].map((item) => item.textContent!.replace('•', '').trim()),
        })),
    );

    expect(pages.length).toBeGreaterThanOrEqual(3);
    expectPagesToFit(pages);
    expect(fragments.length).toBe(pages.length);
    expect(fragments.map((fragment) => fragment.hasHead)).toEqual(fragments.map((_, index) => index === 0));
    expect(fragments.map((fragment) => fragment.hasTags)).toEqual(
      fragments.map((_, index) => index === fragments.length - 1),
    );
    expect(fragments.flatMap((fragment) => fragment.items)).toEqual(LONG_JOB_BULLETS);
  });

  it('moves an entry whole when it cannot keep one item and carry two', async () => {
    await preview.render({
      ...manyJobsResume,
      experience: manyJobsResume.experience.map((job) => ({ ...job, bullets: job.bullets!.slice(0, 2) })),
    });
    const pages = await readPages();

    expect(pages.length).toBeGreaterThanOrEqual(2);
    expectPagesToFit(pages);
    expect(await preview.page.$$eval('#cv .entry--continued', (entries) => entries.length)).toBe(0);
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
