#!/usr/bin/env node

// Run by .github/workflows/pr.yml on each pull request.
import { execFileSync } from 'node:child_process';
import { errorMessage } from './cli.ts';
import { checkPullRequest, type Commit } from './pr-version.ts';

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' });

const versionAt = (sha: string) => (JSON.parse(git('show', `${sha}:package.json`)) as { version: string }).version;

// GitHub's "Update branch" button can add a merge commit, whose message is not a Conventional Commits header.
const readCommits = (from: string, to: string): Commit[] =>
  git('log', '-z', '--no-merges', '--format=%H%n%B', `${from}..${to}`)
    .split('\0')
    .filter(Boolean)
    .map((record) => {
      const newline = record.indexOf('\n');
      return { sha: record.slice(0, newline), message: record.slice(newline + 1) };
    });

try {
  const { PR_TITLE: title, PR_BASE_SHA: base, PR_HEAD_SHA: head } = process.env;
  if (title === undefined || !base || !head) throw new Error('PR_TITLE, PR_BASE_SHA and PR_HEAD_SHA are required');

  // The version main had when the branch started from it.
  const start = git('merge-base', base, head).trim();
  const errors = checkPullRequest({
    title,
    commits: readCommits(start, head),
    baseVersion: versionAt(start),
    headVersion: versionAt(head),
  });
  if (errors.length) {
    console.error(`The pull request cannot be merged yet:\n  ${errors.join('\n  ')}`);
    process.exitCode = 1;
  }
} catch (err) {
  console.error(errorMessage(err));
  process.exitCode = 1;
}
