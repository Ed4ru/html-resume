import * as v from 'valibot';

const TechnologySchema = v.union([
  v.string(),
  v.strictObject({
    name: v.string(),
    primary: v.optional(v.pipe(v.boolean(), v.description('Highlights the technology.'))),
  }),
]);

const StackGroupSchema = v.strictObject({
  label: v.pipe(v.string(), v.description('Group name.'), v.examples(['sales', 'farming'])),
  level: v.optional(
    v.pipe(v.string(), v.description('Level shown to the right of the group.'), v.examples(['expert', 'advanced'])),
  ),
  items: v.pipe(
    v.array(TechnologySchema),
    v.description('Technologies in the group. A string, or an object with primary: true for a filled chip.'),
  ),
});

const LanguageSchema = v.strictObject({
  name: v.pipe(v.string(), v.examples(['English'])),
  level: v.pipe(v.string(), v.description('Displayed level.'), v.examples(['C1 · family heritage'])),
  value: v.pipe(v.number(), v.minValue(0), v.maxValue(100), v.description('Gauge length, in %.')),
});

export const skillsEntries = {
  expertise: v.optional(
    v.pipe(v.array(v.string()), v.description('File: skills.ts. Sidebar expertise, one line each. Rich text.')),
  ),
  stack: v.optional(
    v.pipe(v.array(StackGroupSchema), v.description('File: skills.ts. Sidebar technologies, by group.')),
  ),
  languages: v.optional(
    v.pipe(v.array(LanguageSchema), v.description('File: skills.ts. Spoken languages, with a gauge.')),
  ),
};

export type Technology = v.InferOutput<typeof TechnologySchema>;
export type StackGroup = v.InferOutput<typeof StackGroupSchema>;
export type Language = v.InferOutput<typeof LanguageSchema>;
