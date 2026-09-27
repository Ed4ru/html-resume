#!/usr/bin/env node

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { name } from '../data/index.js';
import { startServer } from './server.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const toFileNameSegment = (text) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const fileName = `CV-${toFileNameSegment(name)}.pdf`;
const pdf = join(root, 'out', fileName);

const server = await startServer();
const browser = await puppeteer.launch({ headless: 'shell' });

try {
  const page = await browser.newPage();

  const errors = [];
  let fail;
  const failed = new Promise((_, reject) => (fail = reject));
  failed.catch(() => {}); // avoids an unhandled rejection if an error fires during goto()
  const error = (message) => {
    errors.push(message);
    fail(new Error(`The resume failed to render:\n  ${errors.join('\n  ')}`));
  };
  page.on('pageerror', (err) => error(err.message));
  page.on('requestfailed', (req) => error(`failed to load ${req.url()}`));
  page.on('response', (res) => res.status() >= 400 && error(`${res.status()} on ${res.url()}`));
  page.on('console', (msg) => msg.type() === 'warn' && console.warn(`⚠ ${msg.text()}`));

  await page.goto(`http://127.0.0.1:${server.address().port}/`);

  await Promise.race([page.waitForSelector('html[data-ready="true"]', { timeout: 15_000 }), failed]);
  if (errors.length) throw await failed.catch((err) => err);

  mkdirSync(join(root, 'out'), { recursive: true });
  await page.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true });
  console.log(`out/${fileName}`);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
