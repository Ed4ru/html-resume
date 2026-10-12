import * as v from 'valibot';
import { richText } from './shared.ts';

const ContactSchema = v.strictObject({
  label: v.pipe(v.string(), v.description('Short label on the left.'), v.examples(['email', 'phone', 'web'])),
  value: v.pipe(v.string(), v.description('Displayed value.')),
  href: v.optional(
    v.pipe(v.string(), v.description('Link (https:, mailto:, tel:). Without a link, the value is plain text.')),
  ),
  accent: v.optional(v.pipe(v.boolean(), v.description('Shows the link in the accent color.'))),
});

const PhotoSchema = v.strictObject({
  src: v.pipe(
    v.string(),
    v.description('Photo file, relative to this data file: .jpg, .jpeg, .png or .webp. Over 500 KB, a warning.'),
    v.examples(['photo.jpg']),
  ),
  alt: v.optional(v.pipe(v.string(), v.description('Text read by screen readers. The name by default.'))),
});

export const profileEntries = {
  photo: v.optional(v.pipe(PhotoSchema, v.description('Photo at the left of the header. Absent: no photo.'))),
  name: v.pipe(v.string(), v.description('Full name, main heading of the resume.')),
  title: v.pipe(
    v.string(),
    v.description("Target job title, below the name. First ATS filter: reuse the job posting's title."),
  ),
  tag: v.optional(
    v.pipe(v.string(), v.description('Short addition next to the title.'), v.examples(['TypeScript · Full-stack'])),
  ),
  summary: v.optional(richText('Profile paragraph below the header.')),
  contact: v.pipe(
    v.array(ContactSchema),
    v.description('Contact details at the right of the header, in display order. Read as "label: value".'),
  ),
};

export type Photo = v.InferOutput<typeof PhotoSchema>;

export type Contact = v.InferOutput<typeof ContactSchema>;
