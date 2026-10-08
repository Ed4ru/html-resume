#!/usr/bin/env node

import { mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { createServer } from 'vite-plus';
import { errorMessage, hasExtension, parseCliArgs, resolveUserPath } from './cli.ts';
import { assertNoFallbackFonts, assertNoSynthesizedFonts } from './font-check.ts';
import { DATA_FILE_ENV, EXAMPLE_DATA_FILE, readResume } from './resume-data.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const toFileNameSegment = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// Everything that can fail before Vite and Chrome are started: the data is validated here, and again
// by the page's Vite plugin, which would only report a 500 on the module.
const resolvePaths = () => {
  const args = parseCliArgs(process.argv.slice(2), { data: { type: 'string' }, out: { type: 'string' } });
  const dataFile = args.data === undefined ? EXAMPLE_DATA_FILE : resolveUserPath(args.data, process.env, process.cwd());
  const resume = readResume(dataFile);
  const pdfFile =
    args.out === undefined
      ? join(root, 'out', `CV-${toFileNameSegment(resume.name)}.pdf`)
      : resolveUserPath(args.out, process.env, process.cwd());
  if (!hasExtension(pdfFile, '.pdf')) throw new Error(`--out must be a .pdf file: ${pdfFile}`);
  if (statSync(pdfFile, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`--out is a directory: ${pdfFile}`);
  }
  return { dataFile, pdfFile };
};

const printPdf = async ({ dataFile, pdfFile }: ReturnType<typeof resolvePaths>) => {
  process.env[DATA_FILE_ENV] = dataFile;
  // The Vite dev server compiles the TypeScript page on the fly, as in the preview.
  const server = await createServer({
    root,
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, hmr: false },
  });
  await server.listen();
  // Without it, headless Chrome on Linux places the glyphs with font hinting, and PDF extractors split
  // words in two ("Regiona l Ma na ger"). It changes nothing on macOS.
  const browser = await puppeteer.launch({ headless: 'shell', args: ['--font-render-hinting=none'] });

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
    page.on('pageerror', (err) => error(errorMessage(err)));
    page.on('requestfailed', (req) => error(`failed to load ${req.url()}`));
    page.on('response', (res) => res.status() >= 400 && error(`${res.status()} on ${res.url()}`));
    page.on('console', (msg) => msg.type() === 'warn' && console.warn(`⚠ ${msg.text()}`));

    const url = server.resolvedUrls?.local[0];
    if (!url) throw new Error('The Vite server did not report a local URL');
    await page.goto(url);

    await Promise.race([page.waitForSelector('html[data-ready="true"]', { timeout: 15_000 }), failed]);
    if (errors.length) throw await failed.catch((err: unknown) => err);
    await assertNoFallbackFonts(page);
    await assertNoSynthesizedFonts(page);

    mkdirSync(dirname(pdfFile), { recursive: true });
    await page.pdf({ path: pdfFile, preferCSSPageSize: true, printBackground: true });
    console.log(pdfFile);
  } catch (err) {
    console.error(errorMessage(err));
    process.exitCode = 1;
  } finally {
    await browser.close();
    await server.close();
  }
};

let paths: ReturnType<typeof resolvePaths> | undefined;
try {
  paths = resolvePaths();
} catch (err) {
  console.error(errorMessage(err));
  process.exitCode = 1;
}
if (paths) await printPdf(paths);
