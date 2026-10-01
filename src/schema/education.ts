import * as v from 'valibot';

const EducationItemSchema = v.union([
  v.string(),
  v.strictObject({
    label: v.pipe(v.string(), v.description('Rich text.')),
    note: v.optional(v.pipe(v.string(), v.examples(['certified']))),
  }),
]);

const EducationSchema = v.strictObject({
  degree: v.pipe(v.string(), v.description('Degree title.')),
  school: v.pipe(v.string(), v.description('School and city.')),
  start: v.pipe(v.string(), v.examples(['1988'])),
  end: v.optional(v.pipe(v.string(), v.examples(['1992']))),
  level: v.optional(v.pipe(v.string(), v.description('Level, shown after the dates.'), v.examples(['Bachelor']))),
  items: v.optional(
    v.pipe(
      v.array(EducationItemSchema),
      v.description('Titles or specializations earned. A string (rich text), or a label with a subtle note.'),
    ),
  ),
});

export const educationEntries = {
  education: v.optional(v.pipe(v.array(EducationSchema), v.description('Education section, most recent first.'))),
};

export type EducationItem = v.InferOutput<typeof EducationItemSchema>;
export type Education = v.InferOutput<typeof EducationSchema>;
