import { defineConfig } from 'vite-plus';
import { resumeDataPlugin } from './scripts/resume-data.ts';

export default defineConfig({
  // Relative asset paths: the site is served from a subpath on GitHub Pages.
  base: './',
  plugins: [resumeDataPlugin()],
  fmt: {
    singleQuote: true,
    printWidth: 120,
    ignorePatterns: ['data/schema.json'],
  },
  // Run by the pre-commit hook (.vite-hooks/pre-commit) on the staged files.
  staged: {
    // Keeps the committed contract in sync with the Valibot schema, unless src/schema/ has unstaged
    // changes that the regenerated file would include.
    'src/schema/**/*.ts': () => [
      'node scripts/assert-schema-staged.ts',
      'node scripts/generate-schema.ts',
      'git add data/schema.json',
    ],
    '*.{ts,js,json,md,css,html,yml,yaml}': 'vp check --fix',
  },
  test: {
    projects: [
      // Rendering logic and schema, in Node: the modules only build HTML strings.
      { test: { name: 'unit', include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'] } },
      // The page in Chrome and the PDF it prints. One Vite server and one browser, started by the
      // global setup, are shared by every test file.
      {
        test: {
          name: 'e2e',
          include: ['tests/e2e/**/*.test.ts'],
          globalSetup: ['tests/e2e/global-setup.ts'],
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
  lint: {
    ignorePatterns: ['dist/**'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
