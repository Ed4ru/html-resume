import type { Resume } from '../src/schema/index.ts';

export const expertise = [
  'B2B paper sales, from prospecting to delivery',
  'Real estate & building management',
  'Beet farming & agritourism',
  'Office safety and evacuation plans',
  'Sales team management',
] satisfies NonNullable<Resume['expertise']>;

export const stack = [
  {
    label: 'sales',
    level: 'expert',
    items: [
      { name: 'Prospecting', primary: true },
      { name: 'Negotiation', primary: true },
      { name: 'Closing', primary: true },
      'Cold calling',
      'Trade shows',
      'CRM',
    ],
  },
  { label: 'farming', level: 'advanced', items: ['Beets', 'Hemp', 'Bed & breakfast'] },
  { label: 'security', items: ['Goju-ryu karate', 'Weapons', 'Survival', 'Surveillance'] },
  { label: 'other', items: ['Notary public', 'Table tennis', 'Second Life'] },
] satisfies NonNullable<Resume['stack']>;

export const languages = [
  { name: 'English', level: 'native', value: 100 },
  { name: 'German', level: 'pre-industrial', value: 60 },
] satisfies NonNullable<Resume['languages']>;
