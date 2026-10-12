// Test data, independent of data/: the tests keep passing when the resume content changes.
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import type { Experience, Resume } from '../../src/schema/index.ts';

// A photo as the page receives it from scripts/resume-data.ts: a data: URL.
export const PHOTO_SRC =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR42mOYtmAnVsQwtCQAUdh7wdq3RugAAAAASUVORK5CYII=';

const crc32 = (bytes: Buffer) => {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
};

const pngChunk = (type: string, data: Buffer) => {
  const typed = Buffer.concat([Buffer.from(type), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
};

// A valid PNG of random pixels, which do not compress: about 3 bytes per pixel.
export const createHeavyPhotoSrc = (size = 480) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const rows = Buffer.concat(
    Array.from({ length: size }, () => Buffer.concat([Buffer.from([0]), randomBytes(size * 3)])),
  );
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(rows)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
};

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
  photo: { src: PHOTO_SRC, alt: 'Portrait of Jane' },
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

// One bullet per line, numbered to check their order across pages.
export const LONG_JOB_BULLETS = Array.from({ length: 100 }, (_, index) => `Deal ${index + 1}: kept the account a year`);

// A job taller than a page: it starts on the first page, after another job, and ends on the third.
export const longJobResume = {
  ...resume,
  experience: [
    ...resume.experience.slice(0, 1),
    {
      role: 'Regional Manager',
      company: 'Dunder Mifflin',
      start: 'Jun 2020',
      bullets: LONG_JOB_BULLETS,
      stack: ['Management', 'B2B sales'],
    },
  ],
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
// The resume as a data file holds it: the photo is a file next to it (scripts/resume-data.ts).
export const PHOTO_FILE = 'photo.png';
export const writePhotoFile = (dir: string) =>
  writeFileSync(join(dir, PHOTO_FILE), Buffer.from(PHOTO_SRC.slice(PHOTO_SRC.indexOf(',') + 1), 'base64'));
export const resumeData = { ...resume, photo: { src: PHOTO_FILE, alt: 'Portrait of Jane' } } satisfies Resume;

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
