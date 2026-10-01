#!/usr/bin/env node

// Runs vp dev on the data file given by --data. The file is not validated here: the page shows the
// errors in Vite's overlay, and reloads once the file is fixed.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { errorMessage, parseCliArgs, resolveUserPath } from './cli.ts';
import { assertDataFile, DATA_FILE_ENV, EXAMPLE_DATA_FILE } from './resume-data.ts';

const root = fileURLToPath(new URL('..', import.meta.url));

// Outside pnpm run, node_modules/.bin is not in the PATH, and vite-plus does not export its bin/ files.
const require = createRequire(import.meta.url);
const manifest = require.resolve('vite-plus/package.json');
const vp = join(dirname(manifest), (require(manifest) as { bin: { vp: string } }).bin.vp);

try {
  const args = parseCliArgs(process.argv.slice(2), {
    data: { type: 'string' },
    open: { type: 'boolean' },
    port: { type: 'string' },
  });
  const dataFile = args.data === undefined ? EXAMPLE_DATA_FILE : resolveUserPath(args.data, process.env, process.cwd());
  assertDataFile(dataFile);

  const devArgs = ['dev', ...(args.open ? ['--open'] : []), ...(args.port === undefined ? [] : ['--port', args.port])];
  // vp looks for the project from its working directory.
  const child = spawn(process.execPath, [vp, ...devArgs], {
    cwd: root,
    env: { ...process.env, [DATA_FILE_ENV]: dataFile },
    stdio: 'inherit',
  });
  child.on('exit', (code) => (process.exitCode = code ?? 1));
} catch (err) {
  console.error(errorMessage(err));
  process.exitCode = 1;
}
