const LABELS = {
  fr: {
    experienceSection: 'Expérience',
    educationSection: 'Formation',
    projectsSection: 'Projets persos',
    contactBlock: 'Contact',
    expertiseBlock: 'Savoir-faire',
    stackBlock: 'Stack',
    languagesBlock: 'Langues',
    currentPositionEnd: 'présent',
  },
  en: {
    experienceSection: 'Experience',
    educationSection: 'Education',
    projectsSection: 'Personal projects',
    contactBlock: 'Contact',
    expertiseBlock: 'Expertise',
    stackBlock: 'Stack',
    languagesBlock: 'Languages',
    currentPositionEnd: 'present',
  },
};

export const SUPPORTED_LANGUAGES = Object.keys(LABELS);

export const getLabels = (lang) => {
  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    throw new Error(`Unsupported language: ${lang} (expected: ${SUPPORTED_LANGUAGES.join(', ')})`);
  }
  return LABELS[lang];
};
