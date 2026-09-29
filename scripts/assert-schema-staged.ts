#!/usr/bin/env node

// Run by the pre-commit hook before data/schema.json is regenerated. The generator reads
// src/schema/ from the working tree: an unstaged change there would end up in the committed
// data/schema.json without its source, so the commit fails instead.
import { execFileSync } from 'node:child_process';

const unstaged = execFileSync('git', ['diff', '--name-only', '--', 'src/schema'], { encoding: 'utf8' }).trim();

if (unstaged) {
  console.error(
    `Unstaged changes in src/schema/ would leak into data/schema.json:\n  ${unstaged.split('\n').join('\n  ')}\nStage or stash them, then commit again.`,
  );
  process.exitCode = 1;
}
