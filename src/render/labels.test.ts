import { expect, it } from 'vite-plus/test';
import { getLabels } from './labels.ts';

it.each([
  ['fr', 'présent'],
  ['en', 'present'],
])('returns the %s labels', (lang, currentPositionEnd) => {
  expect(getLabels(lang).currentPositionEnd).toBe(currentPositionEnd);
});

it('names the supported languages for any other one', () => {
  expect(() => getLabels('de')).toThrow('Unsupported language: de (expected: fr, en)');
});
