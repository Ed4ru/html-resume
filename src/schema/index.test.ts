import * as v from 'valibot';
import { describe, expect, it } from 'vite-plus/test';
import * as data from '../../data/index.ts';
import { resume } from '../../tests/fixtures/resume.ts';
import { ResumeSchema } from './index.ts';

// The dotted path of each issue, such as "settings.qr.url".
const issuePaths = (input: unknown) => {
  const result = v.safeParse(ResumeSchema, input);
  return result.success ? [] : result.issues.map((issue) => v.getDotPath(issue));
};

describe('ResumeSchema', () => {
  // satisfies only checks the value of each export, not the export names nor the runtime constraints.
  it('accepts the data in data/', () => {
    expect(issuePaths({ ...data })).toEqual([]);
  });

  it('accepts the test resume', () => {
    expect(issuePaths(resume)).toEqual([]);
  });

  it.each([
    ['a missing required field', { name: undefined }, 'name'],
    ['an unsupported language', { lang: 'de' }, 'lang'],
    ['a misspelled export', { expertize: ['Sales'] }, 'expertize'],
    [
      'a QR code URL that is not a URL',
      { settings: { showPrompt: true, qr: { url: 'example.com' } } },
      'settings.qr.url',
    ],
    ['a gauge above 100', { languages: [{ name: 'English', level: 'native', value: 101 }] }, 'languages.0.value'],
    ['a technology without a name', { stack: [{ label: 'sales', items: [{ primary: true }] }] }, 'stack.0.items.0'],
  ])('rejects %s, naming the field', (_, overrides, path) => {
    expect(issuePaths({ ...resume, ...overrides })).toContain(path);
  });
});
