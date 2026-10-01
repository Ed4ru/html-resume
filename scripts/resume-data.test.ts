import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, createServer, type InlineConfig } from 'vite-plus';
import { afterAll, afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { resume } from '../tests/fixtures/resume.ts';
import { assertDataFile, DATA_FILE_ENV, EXAMPLE_DATA_FILE, readResume, resumeDataPlugin } from './resume-data.ts';

const dir = mkdtempSync(join(tmpdir(), 'resume-data-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
afterEach(() => vi.unstubAllEnvs());

let fileCount = 0;
const writeData = (text: string) => {
  const file = join(dir, `data-${++fileCount}.json`);
  writeFileSync(file, text);
  return file;
};
const writeJson = (data: unknown) => writeData(JSON.stringify(data));

const directory = join(dir, 'directory.json');
mkdirSync(directory);

const errorOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (err) {
    return err as Error;
  }
  throw new Error('Expected an error');
};

describe('assertDataFile', () => {
  it('accepts a file', () => {
    expect(() => assertDataFile(writeJson(resume))).not.toThrow();
  });

  it('names a missing file', () => {
    const file = join(dir, 'missing.json');
    expect(() => assertDataFile(file)).toThrow(`Data file not found: ${file}`);
  });

  it('names a directory', () => {
    expect(() => assertDataFile(directory)).toThrow(`Data file is not a file: ${directory}`);
  });

  it('names a file that is not a .json file', () => {
    const file = join(dir, 'data.txt');
    writeFileSync(file, JSON.stringify(resume));
    expect(() => assertDataFile(file)).toThrow(`Data file must be a .json file: ${file}`);
  });
});

describe('readResume', () => {
  it('returns the example data', () => {
    expect(readResume(EXAMPLE_DATA_FILE)).toEqual(JSON.parse(readFileSync(EXAMPLE_DATA_FILE, 'utf8')));
  });

  it('accepts a link to the JSON Schema', () => {
    expect(() => readResume(writeJson({ $schema: './schema.json', ...resume }))).not.toThrow();
  });

  it('names a file that is not valid JSON', () => {
    const file = writeData('{"name": ');
    expect(() => readResume(file)).toThrow(`${file} is not valid JSON`);
  });

  it('names a data file that is not a file', () => {
    expect(() => readResume(directory)).toThrow(`Data file is not a file: ${directory}`);
  });

  it.each([
    ['a root that is not an object', null, /^\s*\(root\): /m],
    ['a missing required field', { ...resume, name: undefined }, /^\s*name: missing required field$/m],
    ['an unsupported language', { ...resume, lang: 'de' }, /^\s*lang: /m],
    ['an unknown field', { ...resume, expertize: [] }, /^\s*expertize: unknown field$/m],
    [
      'an unknown nested field',
      { ...resume, settings: { ...resume.settings, theme: 'dark' } },
      /^\s*settings\.theme: unknown field$/m,
    ],
  ])('reports %s on a line starting with its path', (_, data, line) => {
    expect(() => readResume(writeJson(data))).toThrow(line);
  });

  it('reports every error, one per line', () => {
    const file = writeJson({ ...resume, name: undefined, lang: 'de', expertize: [] });
    const { message } = errorOf(() => readResume(file));
    expect(message).toMatch(/^\s*name: /m);
    expect(message).toMatch(/^\s*lang: /m);
    expect(message).toMatch(/^\s*expertize: /m);
  });
});

describe('resumeDataPlugin', () => {
  const inlineConfig: InlineConfig = {
    configFile: false,
    root: dir,
    logLevel: 'silent',
    plugins: [resumeDataPlugin()],
  };

  it('serves the file named by the environment', async () => {
    vi.stubEnv(DATA_FILE_ENV, writeJson(resume));
    const server = await createServer({ ...inlineConfig, server: { middlewareMode: true, ws: false } });
    try {
      const result = await server.transformRequest('virtual:resume-data');
      expect(result?.code).toContain(resume.name);
    } finally {
      await server.close();
    }
  });

  it('builds the example, whatever the environment', async () => {
    vi.stubEnv(DATA_FILE_ENV, writeJson(resume));
    const output = await build({
      ...inlineConfig,
      // Without the entry's exports, the unused data would be left out of the bundle.
      build: { write: false, rolldownOptions: { input: 'virtual:resume-data', preserveEntrySignatures: 'strict' } },
    });
    if (!('output' in output)) throw new Error('Expected a single build output');
    const code = output.output[0].code;
    expect(code).toContain(readResume(EXAMPLE_DATA_FILE).name);
    expect(code).not.toContain(resume.name);
  });
});
