import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import { resume } from '../fixtures/resume.ts';
import { openPreview, type Preview } from './preview.ts';

let preview: Preview;

beforeEach(async () => {
  preview = await openPreview();
  await preview.render(resume);
});

afterEach(async () => {
  await preview.close();
});

// A string, not a function, for the same reason as in preview.ts. Lays out two pages with the real
// renderers, a first page and a next page, then measures every drawn element and its parent before and
// after drawing.
const MEASURE_DRAWING = `async (resume) => {
  const { buildMainColumnBlocks } = await import('/src/render/main-column.ts');
  const { renderContinuationSidebar, renderFirstPageSidebar } = await import('/src/render/sidebar.ts');
  const { drawMarkedText } = await import('/src/render/drawn-text.ts');
  const createPage = (mainHtml, sidebarHtml, sidebarModifier) => {
    const page = document.createElement('section');
    page.className = 'page';
    page.innerHTML = '<div class="page__layout"><main class="page__main"><div class="page__flow">' + mainHtml
      + '</div></main><aside class="page__sidebar ' + sidebarModifier + '">' + sidebarHtml + '</aside></div>';
    return page;
  };
  const pages = [
    createPage(buildMainColumnBlocks(resume).map((block) => block.html).join(''), renderFirstPageSidebar(resume), ''),
    createPage('', renderContinuationSidebar(resume, 2), 'page__sidebar--continued'),
  ];
  const container = document.getElementById('cv');
  container.replaceChildren(...pages);
  const elements = [...container.querySelectorAll('[data-drawn], [data-drawn] *')].flatMap((element) => [element, element.parentElement]);
  const measure = () => elements.map((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return [x, y, width, height];
  });
  const before = measure();
  await drawMarkedText(container);
  return { count: elements.length, before, after: measure() };
}`;

describe('drawn text', () => {
  it('replaces the text of every marked element with SVG paths', async () => {
    const drawn = await preview.page.$$eval('#cv [data-drawn]', (elements) =>
      elements.map((element) => ({ text: element.textContent, paths: element.querySelectorAll('svg path').length })),
    );
    expect(drawn.length).toBeGreaterThan(0);
    for (const { text, paths } of drawn) {
      expect(text).toBe('');
      expect(paths).toBeGreaterThan(0);
    }
  });

  it('keeps the size and position of each drawn element', async () => {
    const { count, before, after } = (await preview.page.evaluate(
      `(${MEASURE_DRAWING})(${JSON.stringify(resume)})`,
    )) as {
      count: number;
      before: number[][];
      after: number[][];
    };
    expect(count).toBeGreaterThan(0);
    after.forEach((rect, index) => {
      rect.forEach((value, side) => expect(value).toBeCloseTo(before[index]![side]!, 2));
    });
  });
});
