// Starts one Vite server and one Chrome for every e2e test file, as scripts/pdf.ts does. Each test
// opens its own page (tests/e2e/preview.ts).
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { createServer } from 'vite-plus';
import type { TestProject } from 'vite-plus/test/node';

declare module 'vite-plus/test' {
  export interface ProvidedContext {
    previewUrl: string;
    browserWSEndpoint: string;
  }
}

export default async function setup(project: TestProject) {
  const server = await createServer({
    root: fileURLToPath(new URL('../..', import.meta.url)),
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, hmr: false },
  });
  await server.listen();
  // Vitest does not call the teardown when the setup fails: the open server would keep it running.
  const fail = async (err: unknown): Promise<never> => {
    await server.close();
    throw err;
  };
  const url = server.resolvedUrls?.local[0] ?? (await fail(new Error('The Vite server did not report a local URL')));
  const browser = await puppeteer.launch({ headless: 'shell' }).catch(fail);

  project.provide('previewUrl', url);
  project.provide('browserWSEndpoint', browser.wsEndpoint());

  return async () => {
    await browser.close();
    await server.close();
  };
}
