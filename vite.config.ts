import { defineConfig } from 'vite-plus';

export default defineConfig({
  // Relative asset paths: the site is served from a subpath on GitHub Pages.
  base: './',
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
  lint: {
    ignorePatterns: ['dist/**'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
