// The PDF read as an ATS does (README, "ATS compatibility"). The expected texts are derived from
// the data, so the same checks run on the test resume and on data/.
import { beforeAll, describe, expect, it } from 'vite-plus/test';
import * as data from '../../data/index.ts';
import { getLabels } from '../../src/render/labels.ts';
import type { Resume } from '../../src/schema/index.ts';
import { resume, SPECIAL_TEXTS, specialCharactersResume } from '../fixtures/resume.ts';
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
  { name: 'data/', resume: { ...data }, render: false },
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
