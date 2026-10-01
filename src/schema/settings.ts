import * as v from 'valibot';

const QrSchema = v.pipe(
  v.strictObject({
    url: v.optional(
      v.pipe(
        v.string(),
        v.url(),
        v.description(
          'URL encoded in the QR code, which is generated at render time. The alt text is derived from it ("QR code en.wikipedia.org/wiki/Dwight_Schrute").',
        ),
        v.examples(['https://en.wikipedia.org/wiki/Dwight_Schrute']),
      ),
    ),
    label: v.optional(v.pipe(v.string(), v.description('Caption shown next to the QR code.'))),
  }),
  v.description('QR code at the bottom of the sidebar, on every page. Absent, or without url: no QR code.'),
);

// Languages of the labels printed on the resume (src/render/labels.ts).
export const LANGUAGES = ['fr', 'en'] as const;

export const settingsEntries = {
  lang: v.pipe(
    v.picklist(LANGUAGES),
    v.description(
      'Language of the document (page lang attribute) and of the labels printed on the resume: section and sidebar titles, end of a current position. Data content is displayed as is.',
    ),
  ),
  settings: v.pipe(
    v.strictObject({
      showPrompt: v.pipe(v.boolean(), v.description('Shows the "~ $ whoami" line above the name.')),
      qr: v.optional(QrSchema),
    }),
    v.description('Display options.'),
  ),
};

export type Qr = v.InferOutput<typeof QrSchema>;
