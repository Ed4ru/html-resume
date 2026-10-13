// Adds Author, Subject and Keywords to the PDF Chrome prints: Chrome ignores the <meta> tags and only
// writes <title>. The fields are added by an incremental update, appended after the bytes of Chrome,
// which stay untouched: the tagged structure, the links and the text are those Chrome wrote.
import type { Resume } from '../src/schema/index.ts';

export interface PdfMetadata {
  author: string;
  subject: string;
  keywords: string[];
}

// The technologies of the sidebar, once each: short keywords, unlike the sentences of expertise.
export const resumeMetadata = (resume: Resume): PdfMetadata => ({
  author: resume.name,
  subject: resume.title,
  keywords: [
    ...new Set(
      (resume.stack ?? []).flatMap((group) => group.items.map((item) => (typeof item === 'string' ? item : item.name))),
    ),
  ],
});

// A text string in UTF-16BE, as Chrome writes the title: accents survive every reader.
export const encodeTextString = (text: string) =>
  `<FEFF${[...Array(text.length).keys()]
    .map((index) => text.charCodeAt(index).toString(16).padStart(4, '0'))
    .join('')
    .toUpperCase()}>`;

const fail = (reason: string): never => {
  throw new Error(`Cannot add the metadata to the PDF: ${reason}`);
};

// Chrome (Skia) writes a PDF 1.4 with a classic cross-reference table, a trailer that names the Info
// dictionary, and no object stream. Any other layout stops the script rather than writing a broken PDF.
const readTrailer = (text: string) => {
  const startxref = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(text);
  if (!startxref) return fail('no startxref at the end of the file');
  const xrefOffset = Number(startxref[1]);
  if (!text.startsWith('xref', xrefOffset)) return fail('no cross-reference table where startxref points');
  const trailer = /trailer\s*<<([\s\S]*?)>>\s*startxref/.exec(text.slice(xrefOffset));
  if (!trailer) return fail('no trailer after the cross-reference table');
  const body = trailer[1]!;
  if (/\/Prev\b/.test(body)) return fail('the PDF already has an incremental update');
  const info = /\/Info (\d+) 0 R/.exec(body);
  if (!info) return fail('the trailer names no Info dictionary');
  return { xrefOffset, body, infoNumber: Number(info[1]) };
};

// The offset of an object, from its entry in the first subsection of the table, which Chrome starts at 0.
const findObjectOffset = (text: string, xrefOffset: number, number: number) => {
  const table = /^xref\s+0 (\d+)\s+/.exec(text.slice(xrefOffset));
  if (!table || number >= Number(table[1])) return fail(`object ${number} is not in the cross-reference table`);
  const entry = text.slice(xrefOffset + table[0].length + number * 20, xrefOffset + table[0].length + number * 20 + 18);
  const [, offset, generation, type] = /^(\d{10}) (\d{5}) ([nf])$/.exec(entry) ?? [];
  if (type !== 'n' || generation !== '00000') return fail(`object ${number} is not in use`);
  return Number(offset);
};

const readInfo = (text: string, offset: number, number: number) => {
  const info = new RegExp(String.raw`^${number} 0 obj\s*<<([\s\S]*?)>>\s*endobj`).exec(text.slice(offset));
  if (!info) return fail(`object ${number} is not the Info dictionary`);
  const body = info[1]!.trimEnd();
  for (const key of ['Author', 'Subject', 'Keywords']) {
    if (new RegExp(String.raw`/${key}\b`).test(body)) fail(`the Info dictionary already has /${key}`);
  }
  return body;
};

export const addPdfMetadata = (pdf: Uint8Array, { author, subject, keywords }: PdfMetadata) => {
  // Latin-1 keeps one character per byte: offsets in the text are offsets in the file.
  const text = Buffer.from(pdf).toString('latin1');
  const { xrefOffset, body: trailer, infoNumber } = readTrailer(text);
  const info = readInfo(text, findObjectOffset(text, xrefOffset, infoNumber), infoNumber);

  const fields = [
    `/Author ${encodeTextString(author)}`,
    `/Subject ${encodeTextString(subject)}`,
    ...(keywords.length ? [`/Keywords ${encodeTextString(keywords.join(', '))}`] : []),
  ];
  const separator = text.endsWith('\n') ? '' : '\n';
  const object = `${infoNumber} 0 obj\n<<${info}\n${fields.join('\n')}>>\nendobj\n`;
  const objectOffset = pdf.length + separator.length;
  const newXrefOffset = objectOffset + object.length;
  // The free entry 0 first: pypdf warns about a table that does not start at 0.
  const update = [
    separator,
    object,
    'xref\n0 1\n0000000000 65535 f \n',
    `${infoNumber} 1\n${String(objectOffset).padStart(10, '0')} 00000 n \n`,
    `trailer\n<<${trailer.trimEnd()}\n/Prev ${xrefOffset}>>\n`,
    `startxref\n${newXrefOffset}\n%%EOF\n`,
  ].join('');
  // The fields are ASCII: hexadecimal strings.
  return new Uint8Array(Buffer.concat([pdf, Buffer.from(update, 'latin1')]));
};
