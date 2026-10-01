import { describe, expect, it } from 'vite-plus/test';
import { hasExtension, parseCliArgs, resolveUserPath } from './cli.ts';

describe('parseCliArgs', () => {
  const options = { data: { type: 'string' }, open: { type: 'boolean' } } as const;

  it.each([
    [[], {}],
    [['--', '--data', 'a'], { data: 'a' }],
    [['--open', '--', '--data', 'a'], { open: true, data: 'a' }],
    [['--data=a.json'], { data: 'a.json' }],
  ])('reads %j', (argv, values) => {
    expect(parseCliArgs(argv, options)).toEqual(values);
  });

  it.each([
    [['--data'], 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE'],
    [['--dat', 'a'], 'ERR_PARSE_ARGS_UNKNOWN_OPTION'],
    [['a.json'], 'ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL'],
  ])('rejects %j', (argv, code) => {
    expect(() => parseCliArgs(argv, options)).toThrow(expect.objectContaining({ code }));
  });
});

describe('resolveUserPath', () => {
  it('keeps an absolute path', () => {
    expect(resolveUserPath('/data/a.json', { npm_package_name: 'html-resume', INIT_CWD: '/from' }, '/repo')).toBe(
      '/data/a.json',
    );
  });

  it('resolves a relative path from the directory pnpm was started from', () => {
    expect(resolveUserPath('a.json', { npm_package_name: 'html-resume', INIT_CWD: '/from' }, '/repo')).toBe(
      '/from/a.json',
    );
  });

  it("ignores another package's INIT_CWD", () => {
    expect(resolveUserPath('a.json', { npm_package_name: 'other-tool', INIT_CWD: '/from' }, '/repo')).toBe(
      '/repo/a.json',
    );
  });

  it('resolves a relative path from the working directory without INIT_CWD', () => {
    expect(resolveUserPath('a.json', { npm_package_name: 'html-resume' }, '/repo')).toBe('/repo/a.json');
  });
});

describe('hasExtension', () => {
  it.each([
    ['a.json', true],
    ['A.JSON', true],
    ['a.json.txt', false],
    ['json', false],
  ])('%s has the .json extension: %s', (file, expected) => {
    expect(hasExtension(file, '.json')).toBe(expected);
  });
});
