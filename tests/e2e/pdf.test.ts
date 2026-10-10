// The PDF read as an ATS does (README, "ATS compatibility"). The expected texts are derived from
// the data, so the same checks run on the test resume and on the example data.
import { beforeAll, describe, expect, it } from 'vite-plus/test';
import { EXAMPLE_DATA_FILE, readResume } from '../../scripts/resume-data.ts';
import { getLabels } from '../../src/render/labels.ts';
import type { Resume } from '../../src/schema/index.ts';
import { LONG_JOB_BULLETS, longJobResume, resume, SPECIAL_TEXTS, specialCharactersResume } from '../fixtures/resume.ts';
import { readPdf, type PdfText } from './pdf-text.ts';
import { openPreview } from './preview.ts';

// Characters that must never reach the PDF text: an en dash is not read as a period separator,
// and the others are drawn by CSS over a standard character.
const FORBIDDEN_CHARACTERS = ['–', '→', '›', '▸'];

// A4, in points.
const A4 = { width: 595.28, height: 841.89 };

const READINGS = ['streamLines', 'layoutLines'] as const;

// Text as an ATS reads it: bold markers dropped, → read as the hyphen drawn under the arrow.
const toPlainText = (richText: string) => richText.replaceAll('**', '').replaceAll('→', '-');

const formatPeriod = (start: string, end?: string) => (end ? `${start} - ${end}` : undefined);

const listPeriods = (resume: Resume) => {
  const { currentPositionEnd } = getLabels(resume.lang);
  return [
    ...(resume.experience ?? []).map((job) => formatPeriod(job.start, job.current ? currentPositionEnd : job.end)),
    ...(resume.education ?? []).map((entry) => formatPeriod(entry.start, entry.end)),
  ].filter((period) => period !== undefined);
};

// The first words of each list item, which start its first line.
const listItemStarts = (resume: Resume) =>
  [
    ...(resume.experience ?? []).flatMap((job) => job.bullets ?? []),
    ...(resume.education ?? []).flatMap((entry) =>
      (entry.items ?? []).map((item) => (typeof item === 'string' ? item : item.label)),
    ),
    ...(resume.expertise ?? []),
  ].map((item) => toPlainText(item).split(' ').slice(0, 3).join(' '));

// Section and sidebar titles, as the CSS writes them (text-transform: uppercase).
const listTitles = (resume: Resume) => {
  const labels = getLabels(resume.lang);
  const sections: [items: readonly unknown[] | undefined, title: string][] = [
    [resume.experience, labels.experienceSection],
    [resume.education, labels.educationSection],
    [resume.projects, labels.projectsSection],
    [resume.contact, labels.contactBlock],
    [resume.expertise, labels.expertiseBlock],
    [resume.stack, labels.stackBlock],
    [resume.languages, labels.languagesBlock],
  ];
  return sections.filter(([items]) => items?.length).map(([, title]) => title.toLocaleUpperCase(resume.lang));
};

// Lines of a reading with their spaces collapsed: pdftotext -layout pads columns with spaces.
const readText = (pdf: PdfText, reading: (typeof READINGS)[number]) =>
  pdf.pages
    .flatMap((page) => page[reading])
    .map((line) => line.replace(/\s+/g, ' '))
    .join('\n');

// Text that src/render/drawn-text.ts draws as paths: none of it may reach the PDF.
const DECORATIONS = ['~ $', 'whoami', 'scan_me'];

const printPdf = async (resume?: Resume) => {
  const preview = await openPreview();
  try {
    if (resume) await preview.render(resume);
    return await readPdf(await preview.pdf());
  } finally {
    await preview.close();
  }
};

const sources: { name: string; resume: Resume; render: boolean }[] = [
  { name: 'test resume', resume, render: true },
  { name: 'French test resume', resume: { ...resume, lang: 'fr' }, render: true },
  { name: 'example data', resume: readResume(EXAMPLE_DATA_FILE), render: false },
];

describe.each(sources)('PDF of the $name', ({ resume, render }) => {
  let pdf: PdfText;

  beforeAll(async () => {
    pdf = await printPdf(render ? resume : undefined);
  });

  it('has A4 pages', () => {
    for (const page of pdf.pages) {
      expect(page.width).toBeCloseTo(A4.width, 0);
      expect(page.height).toBeCloseTo(A4.height, 0);
    }
  });

  it('embeds only static Geist fonts', () => {
    expect(pdf.fonts.length).toBeGreaterThan(0);
    for (const font of pdf.fonts) {
      // Subset prefix, then the family: Geist-Regular, GeistMono-Medium...
      expect(font.name).toMatch(/^[A-Z]{6}\+Geist(Mono)?-/);
      // Chrome embeds variable fonts as Type 3 fonts, which lose the spaces between words.
      expect(font.type).not.toBe('Type3');
    }
  });

  it.each(READINGS)('reads each period on one line, with an ASCII hyphen (%s)', (reading) => {
    const lines = pdf.pages.flatMap((page) => page[reading]);
    for (const period of listPeriods(resume)) {
      expect(
        lines.some((line) => line.includes(period)),
        period,
      ).toBe(true);
    }
  });

  it.each(READINGS)('starts each list item with a standard bullet (%s)', (reading) => {
    const lines = pdf.pages.flatMap((page) => page[reading]);
    for (const start of listItemStarts(resume)) {
      expect(
        lines.some((line) => line.includes(`• ${start}`)),
        start,
      ).toBe(true);
    }
  });

  it.each(READINGS)('contains no drawn character (%s)', (reading) => {
    const text = pdf.pages.flatMap((page) => page[reading]).join('\n');
    for (const character of FORBIDDEN_CHARACTERS) expect(text).not.toContain(character);
  });

  it('keeps every word in one piece for pdftotext -layout', () => {
    expect(pdf.pages.flatMap((page) => page.splitWords)).toEqual([]);
  });

  it('leaves a space pdftotext -raw reads between words', () => {
    expect(pdf.pages.flatMap((page) => page.mergedWords)).toEqual([]);
  });

  it('reads each section title alone on its line, without its number or // (streamLines)', () => {
    const lines = pdf.pages.flatMap((page) => page.streamLines);
    for (const title of listTitles(resume)) expect(lines, title).toContain(title);
  });

  it.each(READINGS)('contains no drawn decoration (%s)', (reading) => {
    const text = pdf.pages.flatMap((page) => page[reading]).join('\n');
    for (const decoration of [...DECORATIONS, '//']) expect(text).not.toContain(decoration);
    if (resume.tag) expect(text).not.toContain(resume.tag);
    if (resume.settings.qr?.label) expect(text).not.toContain(resume.settings.qr.label);
    for (const title of listTitles(resume)) expect(text).not.toMatch(new RegExp(`\\d{2} ${title}`));
  });

  it.each(READINGS)('separates the tags with commas (%s)', (reading) => {
    const text = readText(pdf, reading);
    const tagLists = [...(resume.experience ?? []), ...(resume.projects ?? [])].flatMap((entry) =>
      entry.stack?.length ? [entry.stack] : [],
    );
    expect(tagLists.length).toBeGreaterThan(0);
    for (const tags of tagLists) expect(text).toContain(tags.join(', '));
  });

  it.each(READINGS)('reads each technology group as "label (level): a, b" (%s)', (reading) => {
    const text = readText(pdf, reading);
    for (const { label, level, items } of resume.stack ?? []) {
      expect(text).toContain(level ? `${label} (${level}):` : `${label}:`);
      const names = items.map((item) => (typeof item === 'string' ? item : item.name));
      for (const name of names.slice(0, -1)) expect(text).toContain(`${name},`);
    }
  });

  it.each(READINGS)('reads the name only on the first page (%s)', (reading) => {
    for (const page of pdf.pages.slice(1)) expect(page[reading].join('\n')).not.toContain(resume.name);
  });

  it('reads the name first, then the main column, then the sidebar', () => {
    const lines = pdf.pages[0]!.streamLines;
    expect(lines[0]).toBe(resume.name);
    // A contact line reads "<label> <value>": the value alone can also be in the main column.
    const { label, value } = resume.contact[0]!;
    const firstSidebarLine = lines.findIndex((line) => line.includes(`${label} ${value}`));
    const mainColumnLines = (resume.experience ?? [])
      .map((job) => lines.findIndex((line) => line.includes(job.role)))
      .filter((index) => index >= 0);
    expect(firstSidebarLine).toBeGreaterThan(0);
    expect(mainColumnLines.length).toBeGreaterThan(0);
    for (const index of mainColumnLines) expect(index).toBeLessThan(firstSidebarLine);
  });
});

describe('PDF text', () => {
  it.each(READINGS)('reads → in rich text as a hyphen (%s)', async (reading) => {
    const pdf = await printPdf(resume);
    expect(pdf.pages[0]![reading].join(' ')).toContain('from prospecting - delivery');
  });

  it.each(READINGS)('reads a split entry in order, before the sidebar of each page (%s)', async (reading) => {
    const pdf = await printPdf(longJobResume);
    const continuedPages = pdf.pages.slice(1);
    const lines = pdf.pages.flatMap((page) => page[reading]);
    const bulletLines = LONG_JOB_BULLETS.map((bullet) => lines.findIndex((line) => line.includes(`• ${bullet}`)));

    expect(continuedPages.length).toBeGreaterThan(0);
    expect(bulletLines).not.toContain(-1);
    expect(bulletLines).toEqual([...bulletLines].sort((a, b) => a - b));
    for (const page of continuedPages) expect(page.streamLines[0]).toMatch(/^• Deal \d+:/);
  });

  it.each(READINGS)('keeps accents, quotes, < and & (%s)', async (reading) => {
    const pdf = await printPdf(specialCharactersResume);
    const lines = pdf.pages.flatMap((page) => page[reading]);
    for (const text of SPECIAL_TEXTS) {
      expect(
        lines.some((line) => line.includes(text)),
        text,
      ).toBe(true);
    }
  });
});
