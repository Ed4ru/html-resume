import { execFile } from 'node:child_process';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { expect, it } from 'vite-plus/test';

const root = fileURLToPath(new URL('../..', import.meta.url));

it('writes the PDF of data/ into out/', async () => {
  const startedAt = Date.now();
  const { stdout } = await promisify(execFile)('node', ['scripts/pdf.ts'], { cwd: root });
  const file = stdout.trim();

  expect(file).toMatch(/^out\/CV-[A-Za-z0-9-]+\.pdf$/);
  // Written by this run, not left by a previous one.
  expect(statSync(new URL(`../../${file}`, import.meta.url)).mtimeMs).toBeGreaterThanOrEqual(startedAt);
});
