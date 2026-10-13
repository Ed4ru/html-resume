import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it } from 'vite-plus/test';
import { resumeData } from '../tests/fixtures/resume.ts';
import { addPdfMetadata, encodeTextString, resumeMetadata, type PdfMetadata } from './pdf-metadata.ts';

// A one-page PDF laid out as Chrome (Skia) writes it: the Info dictionary first, a classic
// cross-reference table, and a trailer that names the catalog and the Info dictionary.
const buildPdf = ({ info = '/Title (CV)\n/Producer (Skia/PDF m154)' } = {}) => {
  const objects = [
    `<<${info}>>`,
    '<</Type /Catalog\n/Pages 3 0 R>>',
    '<</Type /Pages\n/Count 1\n/Kids [4 0 R]>>',
    '<</Type /Page\n/Parent 3 0 R\n/MediaBox [0 0 595 842]>>',
  ];
  let text = '%PDF-1.4\n%\xd3\xeb\xe9\xe1\n';
  const offsets = objects.map((object, index) => {
    const offset = text.length;
    text += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = text.length;
  text += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  text += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  text += `trailer\n<</Size ${objects.length + 1}\n/Root 2 0 R\n/Info 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(text, 'latin1'));
};

const METADATA: PdfMetadata = {
  author: 'Dwight K. Schrute III',
  subject: 'Régional Manager',
  keywords: ['Sales', 'Paper'],
};

const readInfo = async (pdf: Uint8Array) => {
  const loadingTask = getDocument({ data: pdf.slice() });
  try {
    const { info } = await (await loadingTask.promise).getMetadata();
    return info as Record<string, unknown>;
  } finally {
    await loadingTask.destroy();
  }
};

const latin1 = (pdf: Uint8Array) => Buffer.from(pdf).toString('latin1');

describe('encodeTextString', () => {
  it('writes UTF-16BE with a byte order mark', () => {
    expect(encodeTextString('Aé')).toBe('<FEFF004100E9>');
  });

  it('writes characters outside the BMP as surrogate pairs', () => {
    expect(encodeTextString('😀')).toBe('<FEFFD83DDE00>');
  });
});

describe('resumeMetadata', () => {
  it('takes the name, the title, and each technology once', () => {
    const metadata = resumeMetadata({
      ...resumeData,
      stack: [
        { label: 'sales', items: ['Salesforce', { name: 'Excel', primary: true }] },
        { label: 'office', items: ['Excel', 'Word'] },
      ],
    });
    expect(metadata).toEqual({
      author: resumeData.name,
      subject: resumeData.title,
      keywords: ['Salesforce', 'Excel', 'Word'],
    });
  });

  it('has no keywords without a stack', () => {
    expect(resumeMetadata({ ...resumeData, stack: undefined }).keywords).toEqual([]);
  });
});

describe('addPdfMetadata', () => {
  it('adds the fields that pdf.js reads, and keeps those of Chrome', async () => {
    const info = await readInfo(addPdfMetadata(buildPdf(), METADATA));
    expect(info).toMatchObject({
      Title: 'CV',
      Producer: 'Skia/PDF m154',
      Author: 'Dwight K. Schrute III',
      Subject: 'Régional Manager',
      Keywords: 'Sales, Paper',
    });
  });

  it('leaves out Keywords when there are none', async () => {
    const info = await readInfo(addPdfMetadata(buildPdf(), { ...METADATA, keywords: [] }));
    expect(info.Keywords).toBeUndefined();
    expect(info.Author).toBe(METADATA.author);
  });

  it('appends an incremental update after the untouched bytes of Chrome', () => {
    const pdf = buildPdf();
    const updated = addPdfMetadata(pdf, METADATA);
    expect(updated.subarray(0, pdf.length)).toEqual(pdf);

    const text = latin1(updated);
    const xref = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(text)![1]);
    expect(xref).toBeGreaterThan(pdf.length);
    const [, entry] = /^xref\n0 1\n0000000000 65535 f \n1 1\n(\d{10}) 00000 n \n/.exec(text.slice(xref))!;
    expect(text.slice(Number(entry))).toMatch(/^1 0 obj\n<<\/Title \(CV\)/);
    const previous = Number(/startxref\n(\d+)/.exec(latin1(pdf))![1]);
    expect(text.slice(xref)).toContain(`/Size 5\n/Root 2 0 R\n/Info 1 0 R\n/Prev ${previous}>>`);
  });

  it('refuses a trailer without an Info dictionary', () => {
    const pdf = new Uint8Array(Buffer.from(latin1(buildPdf()).replace('\n/Info 1 0 R', ''), 'latin1'));
    expect(() => addPdfMetadata(pdf, METADATA)).toThrow('the trailer names no Info dictionary');
  });

  it('refuses a cross-reference stream', () => {
    const pdf = new Uint8Array(Buffer.from(latin1(buildPdf()).replace(/startxref\n\d+/, 'startxref\n9'), 'latin1'));
    expect(() => addPdfMetadata(pdf, METADATA)).toThrow('no cross-reference table where startxref points');
  });

  it('refuses a PDF that already has an incremental update', () => {
    expect(() => addPdfMetadata(addPdfMetadata(buildPdf(), METADATA), METADATA)).toThrow(
      'the PDF already has an incremental update',
    );
  });

  it('refuses to write a field twice', () => {
    const pdf = buildPdf({ info: '/Title (CV)\n/Author (Chrome)' });
    expect(() => addPdfMetadata(pdf, METADATA)).toThrow('the Info dictionary already has /Author');
  });
});
