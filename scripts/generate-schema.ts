#!/usr/bin/env node

// Writes data/schema.json from the Valibot schema in src/schema/. With --check, writes nothing
// and fails if data/schema.json is out of date (used in CI).
import { readFileSync, writeFileSync } from 'node:fs';
import { toJsonSchema } from '@valibot/to-json-schema';
import { ResumeSchema } from '../src/schema/index.ts';

const file = new URL('../data/schema.json', import.meta.url);

// The converter writes `required: []` on objects without required keys. JSON Schema treats it as
// absent: it is left out, as a hand-written schema would.
const omitEmptyRequired = (key: string, value: unknown) =>
  key === 'required' && Array.isArray(value) && value.length === 0 ? undefined : value;

const { $schema, ...schema } = toJsonSchema(ResumeSchema, { target: 'draft-2020-12' });
const json = `${JSON.stringify({ $schema, $id: 'html-resume/data/schema.json', ...schema }, omitEmptyRequired, 2)}\n`;

if (process.argv.includes('--check')) {
  if (readFileSync(file, 'utf8') !== json) {
    console.error('data/schema.json is out of date: run pnpm schema');
    process.exitCode = 1;
  }
} else {
  writeFileSync(file, json);
  console.log('data/schema.json');
}
