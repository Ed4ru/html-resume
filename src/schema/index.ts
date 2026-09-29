// Source of truth for the resume data, split like the files in data/. The types used by the
// rendering code are inferred from it, and data/schema.json, the contract with the tool that
// writes the data, is generated from it (pnpm schema).
import * as v from 'valibot';
import { educationEntries } from './education.ts';
import { experienceEntries } from './experience.ts';
import { profileEntries } from './profile.ts';
import { projectsEntries } from './projects.ts';
import { settingsEntries } from './settings.ts';
import { skillsEntries } from './skills.ts';

export const ResumeSchema = v.pipe(
  v.strictObject({
    ...settingsEntries,
    ...profileEntries,
    ...skillsEntries,
    ...experienceEntries,
    ...educationEntries,
    ...projectsEntries,
  }),
  v.title('Resume data'),
  v.description(
    'Data read by src/render.ts: all exports of data/index.ts, each defined in a data/ file (named in its description). Fields marked "rich text" accept **bold** (highlighted keyword) and → (rendered as an arrow, read as an ASCII hyphen in the PDF text).',
  ),
);

export type Resume = v.InferOutput<typeof ResumeSchema>;
export type { Education, EducationItem } from './education.ts';
export type { Experience } from './experience.ts';
export type { Contact } from './profile.ts';
export type { Project } from './projects.ts';
export type { Qr } from './settings.ts';
export type { Language, StackGroup, Technology } from './skills.ts';
