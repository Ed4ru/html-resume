// Source of truth for the resume data, split into one module per part of the resume. The types
// used by the rendering code are inferred from it, and data/schema.json, which validates and
// documents the data files (editors use it through $schema), is generated from it (pnpm schema).
import * as v from 'valibot';
import { educationEntries } from './education.ts';
import { experienceEntries } from './experience.ts';
import { profileEntries } from './profile.ts';
import { projectsEntries } from './projects.ts';
import { settingsEntries } from './settings.ts';
import { skillsEntries } from './skills.ts';

export const ResumeSchema = v.pipe(
  v.strictObject({
    $schema: v.optional(
      v.pipe(
        v.string(),
        v.description('Link to data/schema.json, for editors: completion and validation. Ignored by the rendering.'),
        v.examples(['./schema.json']),
      ),
    ),
    ...settingsEntries,
    ...profileEntries,
    ...skillsEntries,
    ...experienceEntries,
    ...educationEntries,
    ...projectsEntries,
  }),
  v.title('Resume data'),
  v.description(
    'JSON file passed to pnpm pdf and pnpm preview with --data (data/example.json by default). Fields marked "rich text" accept **bold** (highlighted keyword) and → (rendered as an arrow, read as an ASCII hyphen in the PDF text).',
  ),
);

export type Resume = v.InferOutput<typeof ResumeSchema>;
export type { Education, EducationItem } from './education.ts';
export type { Experience } from './experience.ts';
export type { Contact } from './profile.ts';
export type { Project } from './projects.ts';
export type { Qr } from './settings.ts';
export type { Language, StackGroup, Technology } from './skills.ts';
