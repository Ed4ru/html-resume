import type { Resume } from '../src/schema/index.ts';

export const education = [
  {
    degree: 'Goju-ryu Karate',
    school: 'Scranton dojo',
    start: '2006',
    end: 'May 2013',
    items: ['Black belt', 'Senpai at his dojo'],
  },
  {
    degree: "Bachelor's degree",
    school: 'Scranton Business School',
    start: '1988',
    end: '1992',
  },
] satisfies NonNullable<Resume['education']>;
