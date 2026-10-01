import { extname, resolve } from 'node:path';
import { parseArgs, type ParseArgsOptionsConfig } from 'node:util';

// pnpm appends the user's arguments to the script's own, -- included: `pnpm preview -- --data x`
// runs `preview.ts --open -- --data x`.
export const parseCliArgs = <T extends ParseArgsOptionsConfig>(argv: string[], options: T) => {
  const separator = argv.indexOf('--');
  const args = separator === -1 ? argv : argv.toSpliced(separator, 1);
  return parseArgs({ args, options, strict: true, allowPositionals: false }).values;
};

// pnpm runs the scripts from the repository root and keeps the directory it was started from in
// INIT_CWD. When html-resume is called from another package's script, INIT_CWD belongs to that package.
export const resolveUserPath = (path: string, env: NodeJS.ProcessEnv, cwd: string) =>
  resolve(env.npm_package_name === 'html-resume' && env.INIT_CWD ? env.INIT_CWD : cwd, path);

// Without case, as the file systems of macOS and Windows compare names.
export const hasExtension = (file: string, extension: string) => extname(file).toLowerCase() === extension;

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));
