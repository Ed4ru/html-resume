import * as v from 'valibot';
import { richText, tags } from './shared.ts';

const ExperienceSchema = v.strictObject({
  role: v.pipe(v.string(), v.description('Job title.')),
  company: v.pipe(richText('Company.'), v.examples(['Dunder Mifflin'])),
  location: v.optional(v.pipe(v.string(), v.examples(['Scranton, PA', 'Remote']))),
  start: v.pipe(v.string(), v.description('Start date, as displayed.'), v.examples(['Apr 2001'])),
  end: v.optional(
    v.pipe(
      v.string(),
      v.description(
        'End date, as displayed. When absent (and current absent or false), only the start date is shown. Ignored if current is true.',
      ),
      v.examples(['May 2013']),
    ),
  ),
  current: v.optional(
    v.pipe(
      v.boolean(),
      v.description(
        'Current position: filled node in the timeline, and the end date is replaced by "présent" (lang \'fr\') or "present" (lang \'en\'), even if end is set.',
      ),
    ),
  ),
  context: v.optional(richText('One sentence about the company or product.')),
  bullets: v.optional(v.pipe(v.array(v.string()), v.description('Achievements, one bullet each. Rich text.'))),
  stack: v.optional(tags),
});

export const experienceEntries = {
  experience: v.optional(v.pipe(v.array(ExperienceSchema), v.description('Experience section, most recent first.'))),
};

export type Experience = v.InferOutput<typeof ExperienceSchema>;
