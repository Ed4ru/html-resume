// Test data, independent of data/: the tests keep passing when the resume content changes.
import type { Experience, Resume } from '../../src/schema/index.ts';

const createJob = (index: number): Experience => ({
  role: `Paper Salesman ${index}`,
  company: `Company ${index}`,
  location: 'Scranton, PA',
  start: `Jan ${2000 - index}`,
  end: `Dec ${2000 - index}`,
  context: 'Regional paper distributor with a dozen sales representatives.',
  bullets: [
    `Signed **${index * 10} new accounts** in the first year`,
    'Ran the weekly sales meeting and the quarterly review',
    'Trained two new salesmen on the product catalog',
  ],
  stack: ['B2B sales', 'Paper'],
});

export const resume = {
  lang: 'en',
  settings: {
    showPrompt: true,
    qr: { url: 'https://example.com/jane', label: 'Online profile' },
  },
  name: 'Jane Q. Tester',
  title: 'Sales Manager',
  tag: 'Paper · Sales',
  summary: 'Sales manager with **ten years** of B2B experience, from prospecting → delivery.',
  contact: [
    { label: 'city', value: 'Scranton, PA' },
    { label: 'email', value: 'jane@example.com', href: 'mailto:jane@example.com' },
    { label: 'web', value: 'example.com', href: 'https://example.com', accent: true },
  ],
  expertise: ['B2B sales, from prospecting to delivery', 'Sales team management'],
  stack: [
    { label: 'sales', level: 'expert', items: [{ name: 'Prospecting', primary: true }, 'Negotiation'] },
    { label: 'tools', items: ['CRM', 'Spreadsheets'] },
  ],
  languages: [
    { name: 'English', level: 'native', value: 100 },
    { name: 'German', level: 'school', value: 40 },
  ],
  experience: [
    {
      role: 'Sales Manager',
      company: 'Dunder Mifflin',
      location: 'Scranton, PA',
      start: 'May 2013',
      end: 'Jun 2020',
      current: true,
      context: 'Scranton branch of the paper distribution company.',
      bullets: ['Grew the branch revenue by **12%** in two years', 'Hired and trained **four** salesmen'],
      stack: ['Management', 'B2B sales'],
    },
    {
      role: 'Salesman',
      company: 'Dunder Mifflin',
      start: 'Apr 2001',
      end: 'May 2013',
      bullets: ['**Salesman of the Year** 2005'],
    },
    { role: 'Paper Delivery', company: 'Staples', start: 'Jun 1999' },
  ],
  education: [
    {
      degree: 'Sales Certificate',
      school: 'Scranton Business School',
      start: '1998',
      end: '1999',
      level: 'Certificate',
      items: ['Negotiation', { label: 'Key accounts', note: 'with honors' }],
    },
  ],
  projects: [
    { name: 'Paper Blog', url: 'https://www.example.com/blog/', year: '2010', description: 'Blog on paper stock.' },
    { name: 'Sales Game', description: 'Reward points for the **sales team**.', stack: ['Gamification'] },
  ],
} satisfies Resume;

export const manyJobsResume = {
  ...resume,
  experience: Array.from({ length: 14 }, (_, index) => createJob(index + 1)),
} satisfies Resume;

export const longSidebarResume = {
  ...resume,
  stack: Array.from({ length: 16 }, (_, index) => ({
    label: `group ${index + 1}`,
    items: ['Prospecting', 'Negotiation', 'Closing', 'Cold calling', 'Trade shows', 'CRM'],
  })),
} satisfies Resume;

// Characters missing from the fonts in assets/fonts. A → in a rich text field becomes a drawn
// arrow, but it stays a character in a plain text field such as role.
export const fallbackFontsResume = {
  ...resume,
  experience: [{ role: 'Sales → Management', company: 'Dunder Mifflin', start: '2001', bullets: ['▸ Top seller 🏆'] }],
} satisfies Resume;

export const SPECIAL_TEXTS = [
  `Michael's "best" boss`,
  'L’équipe « Scranton » à Noël',
  'Sales & marketing <B2B>',
  'Façade, crème brûlée, Müller, señor',
];

export const specialCharactersResume = {
  ...resume,
  summary: SPECIAL_TEXTS[0],
  experience: [{ role: 'Sales', company: 'Dunder Mifflin', start: '2001', bullets: SPECIAL_TEXTS.slice(1) }],
} satisfies Resume;
