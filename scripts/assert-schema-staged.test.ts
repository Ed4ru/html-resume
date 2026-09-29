import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it } from 'vite-plus/test';

const script = fileURLToPath(new URL('assert-schema-staged.ts', import.meta.url));

let repository: string;

const git = (...args: string[]) => execFileSync('git', args, { cwd: repository });
const write = (file: string, content: string) => writeFileSync(join(repository, file), content);
const runCheck = () => spawnSync('node', [script], { cwd: repository, encoding: 'utf8' });

beforeEach(() => {
  repository = mkdtempSync(join(tmpdir(), 'assert-schema-staged-'));
  git('init', '--quiet');
  mkdirSync(join(repository, 'src/schema'), { recursive: true });
  write('src/schema/index.ts', 'first\n');
  write('README.md', 'first\n');
  git('add', '.');
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '--quiet', '-m', 'init');
});

afterEach(() => {
  rmSync(repository, { recursive: true, force: true });
});

it('passes when every change in src/schema/ is staged', () => {
  write('src/schema/index.ts', 'second\n');
  git('add', 'src/schema/index.ts');
  expect(runCheck().status).toBe(0);
});

it('passes with unstaged changes outside src/schema/', () => {
  write('README.md', 'second\n');
  expect(runCheck().status).toBe(0);
});

it('fails on an unstaged change in src/schema/, naming the file', () => {
  write('src/schema/index.ts', 'second\n');
  const { status, stderr } = runCheck();
  expect(status).toBe(1);
  expect(stderr).toContain('src/schema/index.ts');
});

it('fails on a partially staged file', () => {
  write('src/schema/index.ts', 'second\n');
  git('add', 'src/schema/index.ts');
  write('src/schema/index.ts', 'third\n');
  expect(runCheck().status).toBe(1);
});
