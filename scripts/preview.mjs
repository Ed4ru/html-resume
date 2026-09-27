#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { startServer } from './server.mjs';

const port = Number(process.env.PORT) || 8000;
const url = `http://localhost:${port}/`;

try {
  await startServer(port);
} catch (err) {
  console.error(err.code === 'EADDRINUSE' ? `Port ${port} is already in use (set PORT=...)` : err.message);
  process.exit(1);
}

console.log(`Preview: ${url} (Ctrl+C to stop)`);
const opener = { darwin: 'open', win32: 'explorer' }[process.platform] ?? 'xdg-open';
spawn(opener, [url], { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
