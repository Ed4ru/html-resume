import { LANGUAGES } from '../schema/settings.ts';

type Lang = (typeof LANGUAGES)[number];

export interface Labels {
  experienceSection: string;
  educationSection: string;
  projectsSection: string;
  contactBlock: string;
  expertiseBlock: string;
  stackBlock: string;
  languagesBlock: string;
  currentPositionEnd: string;
}

const LABELS: Record<Lang, Labels> = {
  fr: {
    experienceSection: 'Expérience professionnelle',
    educationSection: 'Formation',
    projectsSection: 'Projets personnels',
    contactBlock: 'Contact',
    expertiseBlock: 'Compétences',
    stackBlock: 'Compétences techniques',
    languagesBlock: 'Langues',
    currentPositionEnd: 'présent',
  },
  en: {
    experienceSection: 'Experience',
    educationSection: 'Education',
    projectsSection: 'Personal projects',
    contactBlock: 'Contact',
    expertiseBlock: 'Skills',
    stackBlock: 'Technical skills',
    languagesBlock: 'Languages',
    currentPositionEnd: 'present',
  },
};

const isSupportedLanguage = (lang: string): lang is Lang => (LANGUAGES as readonly string[]).includes(lang);

export const getLabels = (lang: string) => {
  if (!isSupportedLanguage(lang)) {
    throw new Error(`Unsupported language: ${lang} (expected: ${LANGUAGES.join(', ')})`);
  }
  return LABELS[lang];
};
