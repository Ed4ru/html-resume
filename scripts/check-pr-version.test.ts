import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it } from 'vite-plus/test';

const script = fileURLToPath(new URL('check-pr-version.ts', import.meta.url));

let repository: string;

const git = (...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], {
    cwd: repository,
    encoding: 'utf8',
  }).trim();

const commit = (message: string, version?: string) => {
  if (version) writeFileSync(join(repository, 'package.json'), `${JSON.stringify({ version })}\n`);
  git('commit', '--quiet', '--allow-empty', '--all', '--message', message);
  return git('rev-parse', 'HEAD');
};

const runCheck = (title: string, base: string, head: string) =>
  spawnSync('node', [script], {
    cwd: repository,
    encoding: 'utf8',
    env: { ...process.env, PR_TITLE: title, PR_BASE_SHA: base, PR_HEAD_SHA: head },
  });

let main: string;

beforeEach(() => {
  repository = mkdtempSync(join(tmpdir(), 'check-pr-version-'));
  git('init', '--quiet', '--initial-branch=main');
  writeFileSync(join(repository, 'package.json'), `${JSON.stringify({ version: '2.0.7' })}\n`);
  git('add', 'package.json');
  main = commit('fix: first');
  git('switch', '--quiet', '--create', 'feature');
});

afterEach(() => {
  rmSync(repository, { recursive: true, force: true });
});

it('passes when the title and the version match the commits of the branch', () => {
  commit('feat: add a section');
  const head = commit('test: cover it', '2.1.0');
  expect(runCheck('feat: add a section', main, head).status).toBe(0);
});

it('measures the version from where the branch started, after main moved on', () => {
  const head = commit('fix: align a date', '2.0.8');
  git('switch', '--quiet', 'main');
  const movedMain = commit('feat: other work', '2.1.0');
  expect(runCheck('fix: align a date', movedMain, head).status).toBe(0);
});

it('ignores the merge commits of an updated branch', () => {
  commit('fix: align a date', '2.0.8');
  git('switch', '--quiet', 'main');
  commit('docs: other work');
  git('switch', '--quiet', 'feature');
  git('merge', '--quiet', '--no-ff', '--no-edit', 'main');
  const head = git('rev-parse', 'HEAD');
  expect(runCheck('fix: align a date', main, head).status).toBe(0);
});

it('fails with every error, one per line', () => {
  const head = commit('feat: add a section');
  const { status, stderr } = runCheck('fix: add a section', main, head);
  expect(status).toBe(1);
  expect(stderr).toMatch(
    /^ {2}title gives a patch version, but commit [0-9a-f]{7} "feat: add a section" gives a minor$/m,
  );
  expect(stderr).toMatch(/^ {2}package\.json: version 2\.0\.7, expected 2\.0\.8/m);
});

it('fails without the pull request in its environment', () => {
  const { status, stderr } = runCheck('fix: x', main, '');
  expect(status).toBe(1);
  expect(stderr).toContain('PR_TITLE, PR_BASE_SHA and PR_HEAD_SHA are required');
});
