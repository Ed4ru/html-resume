import * as v from 'valibot';
import { tags } from './shared.ts';

const ProjectSchema = v.strictObject({
  name: v.string(),
  url: v.optional(v.pipe(v.string(), v.description('Project link, displayed without https:// or www.'))),
  year: v.optional(v.pipe(v.string(), v.examples(['2005']))),
  description: v.pipe(v.string(), v.description('Rich text.')),
  stack: v.optional(tags),
});

export const projectsEntries = {
  projects: v.optional(v.pipe(v.array(ProjectSchema), v.description('Personal projects section.'))),
};

export type Project = v.InferOutput<typeof ProjectSchema>;
