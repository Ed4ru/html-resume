import type { Resume } from '../src/schema/index.ts';

export const projects = [
  {
    name: 'Schrute-Space',
    url: 'https://schrute-space.example',
    year: '2005',
    description: 'Personal blog on bears, beets and Amish traditions.',
    stack: ['Blog', 'Writing'],
  },
  {
    name: 'Schrute Bucks',
    year: '2007',
    description: 'Reward currency created during his interim term as regional manager, worth $0.0001.',
    stack: ['Gamification', 'Management'],
  },
] satisfies NonNullable<Resume['projects']>;
