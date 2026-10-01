import { type ChildProcess, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer, { type Page } from 'puppeteer';
import { afterAll, describe, expect, inject, it } from 'vite-plus/test';
import { resume } from '../fixtures/resume.ts';
import { waitUntilReady } from './preview.ts';
import { runScript, scriptEnv } from './run-script.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));

// Each run starts Node, vp and Vite.
const TIMEOUT = 60_000;

const dir = mkdtempSync(join(tmpdir(), 'preview-script-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const waitForUrl = (child: ChildProcess) =>
  new Promise<string>((resolve, reject) => {
    let output = '';
    const read = (chunk: Buffer) => {
      output += chunk.toString();
      const url = /Local:\s+(http\S+)/.exec(output)?.[1];
      if (url) resolve(url);
    };
    child.stdout?.on('data', read);
    child.stderr?.on('data', read);
    child.on('exit', (code) => reject(new Error(`preview.ts exited with code ${code}:\n${output}`)));
  });

// preview.ts does not forward signals to vp and Vite: they are stopped with it as one process group
// (spawned with detached).
const stopGroup = (child: ChildProcess) => {
  try {
    if (child.pid) process.kill(-child.pid, 'SIGTERM');
  } catch (err) {
    // ESRCH: the whole group has already exited.
    if ((err as NodeJS.ErrnoException).code !== 'ESRCH') throw err;
  }
};

const withPreview = async (data: string, test: (page: Page, errors: string[]) => Promise<void>) => {
  const child = spawn('node', ['scripts/preview.ts', '--data', data, '--port', '0'], {
    cwd: root,
    env: scriptEnv({ NO_COLOR: '1' }),
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = new Promise((resolve) => child.once('exit', resolve));
  try {
    const url = await waitForUrl(child);
    const browser = await puppeteer.connect({ browserWSEndpoint: inject('browserWSEndpoint') });
    const page = await browser.newPage();
    try {
      const errors: string[] = [];
      page.on('response', (res) => res.status() >= 400 && errors.push(`${res.status()} on ${res.url()}`));
      await page.goto(url);
      await test(page, errors);
    } finally {
      await page.close();
      await browser.disconnect();
    }
  } finally {
    stopGroup(child);
    await exited;
  }
};

const readName = (page: Page) => page.$eval('.header__name', (element) => element.textContent);
const readOverlay = async (page: Page) => {
  const overlay = await page.waitForSelector('vite-error-overlay', { timeout: 15_000 });
  return overlay?.evaluate((element) => element.shadowRoot?.textContent);
};

const rewrite = async (page: Page, file: string, text: string) => {
  const reloaded = page.waitForNavigation({ timeout: 15_000 });
  writeFileSync(file, text);
  await reloaded;
};

describe('pnpm preview', () => {
  it(
    'shows the data file',
    async () => {
      const data = join(dir, 'shown.json');
      writeFileSync(data, JSON.stringify({ ...resume, lang: 'fr' }));

      await withPreview(data, async (page) => {
        await waitUntilReady(page);
        expect(await readName(page)).toBe(resume.name);
        expect(await page.$eval('html', (element) => element.lang)).toBe('fr');
      });
    },
    TIMEOUT,
  );

  it(
    'reloads the page when the data file changes',
    async () => {
      const data = join(dir, 'changed.json');
      writeFileSync(data, JSON.stringify(resume));

      await withPreview(data, async (page) => {
        await waitUntilReady(page);
        await rewrite(page, data, JSON.stringify({ ...resume, name: 'Changed Name' }));
        await waitUntilReady(page);
        expect(await readName(page)).toBe('Changed Name');
      });
    },
    TIMEOUT,
  );

  it(
    'shows the errors of an invalid data file in the overlay',
    async () => {
      const data = join(dir, 'invalid.json');
      writeFileSync(data, JSON.stringify(resume));

      await withPreview(data, async (page, errors) => {
        await waitUntilReady(page);
        await rewrite(page, data, JSON.stringify({ ...resume, name: undefined }));
        expect(await readOverlay(page)).toMatch(/name: missing required field/);
        expect(errors).toContainEqual(expect.stringMatching(/^500 on .*\/@id\/__x00__virtual:resume-data/));
      });
    },
    TIMEOUT,
  );

  it(
    'reloads the page once a file that was invalid from the start is fixed',
    async () => {
      const data = join(dir, 'fixed.json');
      writeFileSync(data, '{"name": ');

      await withPreview(data, async (page) => {
        expect(await readOverlay(page)).toMatch(/is not valid JSON/);
        await rewrite(page, data, JSON.stringify(resume));
        await waitUntilReady(page);
        expect(await readName(page)).toBe(resume.name);
      });
    },
    TIMEOUT,
  );

  it.each([
    ['a missing data file', ['--data', 'missing.json'], /^Data file not found: /m],
    ['an unknown option', ['--host'], /^Unknown option '--host'/m],
  ])('fails on %s', async (_, args, message) => {
    const { code, stderr } = await runScript('node', ['scripts/preview.ts', ...args], { cwd: root });

    expect(code).toBe(1);
    expect(stderr).toMatch(message);
  });
});
