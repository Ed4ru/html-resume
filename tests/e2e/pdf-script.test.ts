import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vite-plus/test';
import { getLabels } from '../../src/render/labels.ts';
import { resume } from '../fixtures/resume.ts';
import { readPdf } from './pdf-text.ts';
import { runScript } from './run-script.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));

// Each run starts pnpm or Node, Vite and Chrome.
const TIMEOUT = 60_000;

// A space, an accent and an apostrophe, which a path must survive through pnpm and the shell. Its
// real path (/private/var on macOS): pnpm sets INIT_CWD to the working directory with links resolved.
const dir = realpathSync(mkdtempSync(join(tmpdir(), "html-resume l'é ")));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const lastLine = (text: string) => text.trim().split('\n').at(-1);

const readPdfLines = async (file: string) =>
  (await readPdf(new Uint8Array(readFileSync(file)))).pages.flatMap((page) => page.streamLines);

describe('pnpm pdf', () => {
  it(
    'writes the PDF of the example into out/ without arguments',
    async () => {
      const startedAt = Date.now();
      const { code, stdout } = await runScript('node', ['scripts/pdf.ts'], { cwd: root });
      const file = lastLine(stdout) ?? '';

      expect(code).toBe(0);
      expect(dirname(file)).toBe(join(root, 'out'));
      expect(basename(file)).toMatch(/^CV-[A-Za-z0-9-]+\.pdf$/);
      // Written by this run, not left by a previous one.
      expect(statSync(file).mtimeMs).toBeGreaterThanOrEqual(startedAt);
    },
    TIMEOUT,
  );

  it(
    'reads --data and writes --out relative to the directory it is run from',
    async () => {
      // Written by hand: escaped quotes and a \u escape, as a tool writing JSON may produce them.
      const json = JSON.stringify({ ...resume, name: 'NAME' }).replace('"NAME"', String.raw`"Jane \"Q\" Téster"`);
      writeFileSync(join(dir, 'a.json'), json);

      const { code, stdout } = await runScript(
        'pnpm',
        ['--dir', root, 'pdf', '--data', 'a.json', '--out', 'sub dir é/a.pdf'],
        {
          cwd: dir,
        },
      );
      const file = join(dir, 'sub dir é', 'a.pdf');

      expect(code).toBe(0);
      expect(lastLine(stdout)).toBe(file);
      expect(await readPdfLines(file)).toContain('Jane "Q" Téster');
    },
    TIMEOUT,
  );

  it(
    'names the invalid field and stops before Chrome, without writing anything',
    async () => {
      const data = join(dir, 'invalid.json');
      writeFileSync(data, JSON.stringify({ ...resume, name: undefined }));
      const out = join(dir, 'invalid out');

      const { code, stderr } = await runScript(
        'node',
        ['scripts/pdf.ts', '--data', data, '--out', join(out, 'a.pdf')],
        {
          cwd: root,
          // Chrome would fail to start: the run must stop before.
          env: { PUPPETEER_EXECUTABLE_PATH: '/nonexistent/chrome' },
        },
      );

      expect(code).toBe(1);
      expect(stderr).toMatch(/^\s*name: missing required field$/m);
      expect(stderr).not.toContain('/nonexistent/chrome');
      expect(existsSync(out)).toBe(false);
    },
    TIMEOUT,
  );

  it(
    'refuses an --out that is a directory',
    async () => {
      const out = join(dir, 'existing dir.pdf');
      mkdirSync(out);

      const { code, stderr } = await runScript('node', ['scripts/pdf.ts', '--out', out], { cwd: root });

      expect(code).toBe(1);
      expect(stderr).toContain(`--out is a directory: ${out}`);
    },
    TIMEOUT,
  );

  it(
    'refuses an --out that is not a .pdf file',
    async () => {
      const out = join(dir, 'resume.json');

      const { code, stderr } = await runScript('node', ['scripts/pdf.ts', '--out', out], { cwd: root });

      expect(code).toBe(1);
      expect(stderr).toContain(`--out must be a .pdf file: ${out}`);
      expect(existsSync(out)).toBe(false);
    },
    TIMEOUT,
  );

  it(
    'renders only the sections of the data file, without falling back on the example',
    async () => {
      // JSON.stringify leaves out the undefined keys.
      const partial = { ...resume, projects: undefined, education: undefined };
      const data = join(dir, 'partial.json');
      writeFileSync(data, JSON.stringify(partial));
      const out = join(dir, 'partial.pdf');

      const { code } = await runScript('node', ['scripts/pdf.ts', '--data', data, '--out', out], { cwd: root });
      const text = (await readPdfLines(out)).join('\n');
      const labels = getLabels(partial.lang);

      expect(code).toBe(0);
      expect(text).toContain(labels.experienceSection.toUpperCase());
      expect(text).not.toContain(labels.educationSection.toUpperCase());
      expect(text).not.toContain(labels.projectsSection.toUpperCase());
    },
    TIMEOUT,
  );
});
