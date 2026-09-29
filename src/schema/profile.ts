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

export const profileEntries = {
  name: v.pipe(v.string(), v.description('File: profile.ts. Full name, main heading of the resume.')),
  title: v.pipe(
    v.string(),
    v.description(
      "File: profile.ts. Target job title, below the name. First ATS filter: reuse the job posting's title.",
    ),
  ),
  tag: v.optional(
    v.pipe(
      v.string(),
      v.description('File: profile.ts. Short addition next to the title.'),
      v.examples(['TypeScript · Full-stack']),
    ),
  ),
  summary: v.optional(richText('File: profile.ts. Profile paragraph below the header.')),
  contact: v.pipe(
    v.array(ContactSchema),
    v.description('File: profile.ts. Sidebar contact details, in display order.'),
  ),
};

export type Contact = v.InferOutput<typeof ContactSchema>;
