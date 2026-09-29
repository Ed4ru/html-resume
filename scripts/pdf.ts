#!/usr/bin/env node

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { createServer } from 'vite-plus';
import { name } from '../data/index.ts';
import { assertNoFallbackFonts } from './font-check.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const toFileNameSegment = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const fileName = `CV-${toFileNameSegment(name)}.pdf`;
const pdf = join(root, 'out', fileName);

// The Vite dev server compiles the TypeScript page on the fly, as in the preview.
const server = await createServer({
  root,
  logLevel: 'silent',
  server: { host: '127.0.0.1', port: 0, hmr: false },
});
await server.listen();
const browser = await puppeteer.launch({ headless: 'shell' });

try {
  const page = await browser.newPage();

  const errors: string[] = [];
  let fail: (reason: Error) => void = () => {};
  const failed = new Promise<never>((_, reject) => (fail = reject));
  failed.catch(() => {}); // avoids an unhandled rejection if an error fires during goto()
  const error = (message: string) => {
    errors.push(message);
    fail(new Error(`The resume failed to render:\n  ${errors.join('\n  ')}`));
  };
  page.on('pageerror', (err) => error(err instanceof Error ? err.message : String(err)));
  page.on('requestfailed', (req) => error(`failed to load ${req.url()}`));
  page.on('response', (res) => res.status() >= 400 && error(`${res.status()} on ${res.url()}`));
  page.on('console', (msg) => msg.type() === 'warn' && console.warn(`⚠ ${msg.text()}`));

  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error('The Vite server did not report a local URL');
  await page.goto(url);

  await Promise.race([page.waitForSelector('html[data-ready="true"]', { timeout: 15_000 }), failed]);
  if (errors.length) throw await failed.catch((err: unknown) => err);
  await assertNoFallbackFonts(page);

  mkdirSync(join(root, 'out'), { recursive: true });
  await page.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true });
  console.log(`out/${fileName}`);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
