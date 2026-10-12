import { readFileSync, statSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as v from 'valibot';
import { normalizePath, type Plugin } from 'vite-plus';
import { type Resume, ResumeSchema } from '../src/schema/index.ts';
import { errorMessage, hasExtension } from './cli.ts';

export const EXAMPLE_DATA_FILE = fileURLToPath(new URL('../data/example.json', import.meta.url));

export const DATA_FILE_ENV = 'RESUME_DATA';

const MODULE_ID = 'virtual:resume-data';
const RESOLVED_MODULE_ID = `\0${MODULE_ID}`;

export const assertDataFile = (file: string) => {
  if (!hasExtension(file, '.json')) throw new Error(`Data file must be a .json file: ${file}`);
  const stats = statSync(file, { throwIfNoEntry: false });
  if (!stats) throw new Error(`Data file not found: ${file}`);
  if (!stats.isFile()) throw new Error(`Data file is not a file: ${file}`);
};

type Issue = v.InferIssue<typeof ResumeSchema>;

// Valibot reports an unknown key and a missing one both as "Invalid key".
const formatIssue = (issue: Issue) => {
  const path = v.getDotPath(issue) ?? '(root)';
  if (issue.type === 'strict_object' && issue.expected === 'never') return `${path}: unknown field`;
  if (issue.type === 'strict_object' && issue.received === 'undefined') return `${path}: missing required field`;
  return `${path}: ${issue.message}`;
};

const PHOTO_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export const resolvePhotoFile = (dataFile: string, src: string) => resolve(dirname(dataFile), src);

// The page cannot read a file next to the data file, which can be anywhere: the photo is passed to it as
// a data: URL, in place of its path.
const embedPhoto = (dataFile: string, resume: Resume): Resume => {
  if (!resume.photo) return resume;
  const photoFile = resolvePhotoFile(dataFile, resume.photo.src);
  const type = PHOTO_TYPES[extname(photoFile).toLowerCase()];
  if (!type) throw new Error(`Photo must be a .jpg, .jpeg, .png or .webp file: ${photoFile}`);
  if (!statSync(photoFile, { throwIfNoEntry: false })?.isFile()) throw new Error(`Photo not found: ${photoFile}`);
  const src = `data:${type};base64,${readFileSync(photoFile).toString('base64')}`;
  return { ...resume, photo: { ...resume.photo, src } };
};

const parseResume = (file: string): Resume => {
  assertDataFile(file);
  const text = readFileSync(file, 'utf8');

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new Error(`${file} is not valid JSON: ${errorMessage(err)}`);
  }

  const result = v.safeParse(ResumeSchema, json);
  if (!result.success) {
    throw new Error(`${file} does not match data/schema.json:\n  ${result.issues.map(formatIssue).join('\n  ')}`);
  }
  return result.output;
};

// The resume as the page renders it: validated, with its photo embedded.
export const readResume = (file: string) => embedPhoto(file, parseResume(file));

// The build, deployed to GitHub Pages, always shows the example, whatever the environment.
export const resumeDataPlugin = (): Plugin => {
  let file = '';
  let photoFile = '';
  return {
    name: 'resume-data',
    configResolved(config) {
      const fromEnv = config.command === 'serve' ? process.env[DATA_FILE_ENV] : undefined;
      // Vite passes normalized paths (forward slashes, even on Windows) to hotUpdate.
      file = normalizePath(fromEnv || EXAMPLE_DATA_FILE);
    },
    resolveId: (id) => (id === MODULE_ID ? RESOLVED_MODULE_ID : undefined),
    load(id) {
      if (id !== RESOLVED_MODULE_ID) return;
      // Before reading: an invalid file is watched too, so fixing it reloads the page.
      this.addWatchFile(file);
      const resume = parseResume(file);
      // Watched too, before reading it: replacing the photo reloads the page.
      photoFile = resume.photo ? normalizePath(resolvePhotoFile(file, resume.photo.src)) : '';
      if (photoFile) this.addWatchFile(photoFile);
      return `export default ${JSON.stringify(embedPhoto(file, resume))};`;
    },
    // Vite alone would not reload the page after a change to a file that was already invalid when the
    // page first loaded, or to the photo, which is not a module (it never entered the module graph), or that is reached through a symbolic link
    // (such as /var → /private/var on macOS).
    hotUpdate({ file: changed }) {
      if (changed !== file && changed !== photoFile) return;
      const { moduleGraph, hot } = this.environment;
      const module = moduleGraph.getModuleById(RESOLVED_MODULE_ID);
      if (module) moduleGraph.invalidateModule(module);
      hot.send({ type: 'full-reload' });
      return [];
    },
  };
};
