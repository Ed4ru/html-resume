import { execFile } from 'node:child_process';
import { DATA_FILE_ENV } from '../../scripts/resume-data.ts';

// The environment of the scripts run by the tests, without the variables set by pnpm test (INIT_CWD,
// npm_package_name), which would change how relative paths resolve, and by the global setup (DATA_FILE_ENV).
export const scriptEnv = (variables: NodeJS.ProcessEnv = {}) => {
  const env: NodeJS.ProcessEnv = { ...process.env, ...variables };
  for (const name of ['INIT_CWD', 'npm_package_name', DATA_FILE_ENV]) delete env[name];
  return env;
};

export const runScript = (command: string, args: string[], options: { cwd: string; env?: NodeJS.ProcessEnv }) =>
  new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    execFile(command, args, { cwd: options.cwd, env: scriptEnv(options.env) }, (error, stdout, stderr) =>
      resolve({ code: error ? Number(error.code ?? 1) : 0, stdout, stderr }),
    );
  });
