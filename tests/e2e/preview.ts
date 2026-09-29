import puppeteer, { type Page } from 'puppeteer';
import { inject } from 'vite-plus/test';
import type { Resume } from '../../src/schema/index.ts';

export interface Preview {
  page: Page;
  // Page errors, failed requests and HTTP errors, as scripts/pdf.ts reports them.
  errors: string[];
  warnings: string[];
  // Renders another resume in place of data/, as src/main.ts does.
  render: (resume: Resume) => Promise<void>;
  // Prints the page with the options of scripts/pdf.ts.
  pdf: () => Promise<Uint8Array>;
  close: () => Promise<void>;
}

// A string, not a function: Vitest would rewrite its import() for Node. The module is served by
// Vite, the same instance as the one src/main.ts imported.
const RENDER_IN_PAGE = `async (resume) => {
  delete document.documentElement.dataset.ready;
  const { renderResume } = await import('/src/render.ts');
  await renderResume(resume);
}`;

const waitUntilReady = (page: Page) => page.waitForSelector('html[data-ready="true"]', { timeout: 15_000 });

export const openPreview = async (): Promise<Preview> => {
  const browser = await puppeteer.connect({ browserWSEndpoint: inject('browserWSEndpoint') });
  const page = await browser.newPage();
  const errors: string[] = [];
  const warnings: string[] = [];
  page.on('pageerror', (err) => errors.push(err instanceof Error ? err.message : String(err)));
  page.on('requestfailed', (req) => errors.push(`failed to load ${req.url()}`));
  page.on('response', (res) => res.status() >= 400 && errors.push(`${res.status()} on ${res.url()}`));
  page.on('console', (msg) => msg.type() === 'warn' && warnings.push(msg.text()));

  await page.goto(inject('previewUrl'));
  await waitUntilReady(page);

  return {
    page,
    errors,
    warnings,
    render: async (resume) => {
      await page.evaluate(`(${RENDER_IN_PAGE})(${JSON.stringify(resume)})`);
      await waitUntilReady(page);
    },
    pdf: () => page.pdf({ preferCSSPageSize: true, printBackground: true }),
    close: async () => {
      await page.close();
      await browser.disconnect();
    },
  };
};
