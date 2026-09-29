import * as v from 'valibot';

export const richText = (description: string) => v.pipe(v.string(), v.description(`${description} Rich text.`));

export const tags = v.pipe(v.array(v.string()), v.description('Technologies used, shown as tags.'));
