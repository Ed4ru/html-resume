import { expect, it } from 'vite-plus/test';
import { LANGUAGES } from '../schema/settings.ts';
import { getLabels, type Labels } from './labels.ts';

it.each([
  ['fr', 'présent'],
  ['en', 'present'],
])('returns the %s labels', (lang, currentPositionEnd) => {
  expect(getLabels(lang).currentPositionEnd).toBe(currentPositionEnd);
});

it('names the supported languages for any other one', () => {
  expect(() => getLabels('de')).toThrow('Unsupported language: de (expected: fr, en)');
});

// Words ATS parsers look for to split a resume into sections. A title without one is read as content.
type TitleLabel = Exclude<keyof Labels, 'currentPositionEnd'>;

const TITLE_KEYWORDS: Record<(typeof LANGUAGES)[number], Record<TitleLabel, string>> = {
  en: {
    experienceSection: 'experience',
    educationSection: 'education',
    projectsSection: 'project',
    contactBlock: 'contact',
    expertiseBlock: 'skill',
    stackBlock: 'skill',
    languagesBlock: 'language',
  },
  fr: {
    experienceSection: 'expérience',
    educationSection: 'formation',
    projectsSection: 'projet',
    contactBlock: 'contact',
    expertiseBlock: 'compétence',
    stackBlock: 'compétence',
    languagesBlock: 'langue',
  },
};

it.each(Object.entries(TITLE_KEYWORDS))('names each %s section with a word ATS parsers look for', (lang, keywords) => {
  const labels = getLabels(lang);
  for (const [key, keyword] of Object.entries(keywords)) {
    expect(labels[key as TitleLabel].toLowerCase(), key).toContain(keyword);
  }
});
