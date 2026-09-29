# html-resume

Generates an A4 PDF resume from the data in `data/`, rendered with TypeScript, HTML and CSS.

The PDF is the deliverable. The HTML page is only used to preview the resume in a browser.

The data is written by an external tool. This repository only renders it. The contract between
the two is `data/schema.json`.

## Prerequisites

| Tool                                 | Version                                 |
| ------------------------------------ | --------------------------------------- |
| [Node.js](https://nodejs.org/)       | 22.x from 22.22.1, 24.x from 24.11, 26+ |
| [pnpm](https://pnpm.io/installation) | 11.25.0                                 |

The browser used to generate the PDF does not need to be installed manually: `pnpm install`
downloads it (see below). Node.js runs the TypeScript scripts directly, without a build step. The minimum versions
come from Vite+: its test runner needs 22.18 or 24.11, and the pre-commit hook (see [Contributing](#contributing))
needs 22.22.1 on the 22.x line.

## Installation

```sh
pnpm install
```

This installs:

- [uqr](https://github.com/unjs/uqr), which generates the QR code in the page.
- [Vite+](https://viteplus.dev/), the toolchain: Vite serves and builds the page, Oxfmt formats, Oxlint lints and
  type-checks. `pnpm-workspace.yaml` points `vite` and `vitest` to the copies shipped with Vite+.
- [Valibot](https://valibot.dev/), in which the data schema is written (see [Field reference](#field-reference)).
- [Puppeteer](https://pptr.dev/), and downloads `chrome-headless-shell`, the headless Chromium it
  uses, into `~/.cache/puppeteer`.

- `.puppeteerrc.json` limits the download to `chrome-headless-shell` (the full Chrome is skipped).
- The Puppeteer version, and therefore the browser version, is locked by `pnpm-lock.yaml`.
- The `prepare` script installs the Git pre-commit hook (see [Contributing](#contributing)).

## Usage

| Command        | Result                                                                   |
| -------------- | ------------------------------------------------------------------------ |
| `pnpm preview` | Serves the resume at `http://localhost:5173` and opens it in the browser |
| `pnpm pdf`     | Generates `out/CV-<name>.pdf`                                            |
| `pnpm check`   | Checks formatting, lint rules and types                                  |
| `pnpm test`    | Runs the unit tests, then the tests of the page and the PDF in Chrome    |
| `pnpm schema`  | Regenerates `data/schema.json` from `src/schema/`                        |
| `pnpm build`   | Builds the preview into `dist/`, as deployed to GitHub Pages             |

### Preview

```sh
pnpm preview
pnpm preview --port 8080   # use another port
```

The page reloads by itself after a change to the data or the code. Press Ctrl+C to stop the server.

The toolbar at the top of the preview has a **Print / PDF** button that opens the browser's
print dialog.

### PDF

```sh
pnpm pdf
```

- `<name>` comes from `name` in `data/profile.ts`, without accents or special characters:
  `Dwight K. Schrute III` gives `out/CV-Dwight-K-Schrute-III.pdf`.
- The command serves the page with Vite, as the preview does, and waits for it to finish rendering before printing.
- It fails, without writing a PDF, if a file cannot be loaded or if the rendering throws an error.
- It also fails, without writing a PDF, if a character is missing from the fonts in
  `assets/fonts/`: Chrome would draw it with a system font, which changes from one machine to
  another. The message names the character, the text it appears in and the system font.
- It prints a warning if the sidebar overflows the first page (see [Layout](#layout)).

## Filling in the data

### Files

Each file in `data/` holds part of the resume. `data/index.ts` re-exports all of them.

| File                 | Keys                                         |
| -------------------- | -------------------------------------------- |
| `data/settings.ts`   | `lang`, `settings`                           |
| `data/profile.ts`    | `name`, `title`, `tag`, `summary`, `contact` |
| `data/skills.ts`     | `expertise`, `stack`, `languages`            |
| `data/experience.ts` | `experience`                                 |
| `data/education.ts`  | `education`                                  |
| `data/projects.ts`   | `projects`                                   |

### Format

The files are TypeScript modules. Each key is a named export whose value is checked against the schema with
`satisfies`: `pnpm check` reports a missing or misspelled field inside it, or a value of the wrong type. It does not
check the export names themselves (a misspelled optional export, such as `expertize`, is ignored and its section is
not rendered), nor the constraints that only exist at runtime (URL format, gauge between 0 and 100): `pnpm test`
checks both, by parsing the data with the schema.

```ts
export const lang = 'en' satisfies Resume['lang'];

export const contact = [
  { label: 'email', value: 'jane@example.com', href: 'mailto:jane@example.com' },
] satisfies Resume['contact'];
```

### Field reference

The schema of the data is written with Valibot in `src/schema/`, split like the files in `data/`: one module per data
file, assembled by `src/schema/index.ts`. It is the source of truth: the types used by the rendering code are inferred
from it.

`data/schema.json` is generated from it by `pnpm schema`, as a JSON Schema (draft 2020-12). It is the contract with the
tool that writes the data, so it stays in the repository. For every field, it gives the type, whether it is required,
the file it belongs to, and what it is used for. The CI fails if it is not up to date.

Required keys: `lang`, `settings`, `name`, `title`, `contact`. Every other section is optional
and is not rendered when it is missing or empty.

### Rendering rules

- **Language**: `lang` is `'fr'` or `'en'`. It sets the labels printed on the resume: section
  titles (`Expérience` / `Experience`, `Formation` / `Education`, `Projets persos` /
  `Personal projects`), sidebar titles (`Savoir-faire` / `Expertise`, `Langues` / `Languages`,
  `Contact`, `Stack`) and the end of a current position (`présent` / `present`). The labels are
  defined in `src/render/labels.ts`. The data itself is displayed as written, so it must be written in
  the chosen language. Any other value of `lang` stops the rendering with an error.
- **Rich text**: in `summary`, `company`, `context`, `bullets`, `expertise`, education items and
  project descriptions, `**text**` is rendered in bold and `→` as an arrow.
- **Current position**: `current: true` marks a position as current. Its timeline node is filled,
  and the end date is replaced with `présent` when `lang` is `'fr'`, or `present` when it is
  `'en'`, even if `end` is set.
- **Dates**: `start` and `end` are displayed as written. Without `end` (and without
  `current: true`), only the start date is displayed.
- **Highlighted technology**: a `stack` item is either a string (`'Vite'`) or an object
  (`{ name: 'Vue.js', primary: true }`). `primary: true` renders it as a filled chip.
- **Language gauge**: `value` is the length of the gauge, in percent.
- **QR code**: generated from `settings.qr.url` when the resume is rendered. `label` is the text
  displayed next to it, and the alternative text is derived from the URL
  (`QR code en.wikipedia.org/wiki/Dwight_Schrute`). Without `settings.qr`, or without `url`, no QR code is displayed.
- **Hiding elements**: `settings.showPrompt: false` hides the `~ $ whoami` line above the name.
- **Order**: lists are rendered in the order they are written.

## Layout

- The main column is split across as many A4 pages as needed.
- A block, such as a position, is never split between two pages. If it does not fit, the whole
  block moves to the next page.
- A section title always stays on the same page as the block that follows it.
- The full sidebar only appears on the first page. The following pages only show the name, the
  title, the page number and the QR code.
- The sidebar cannot continue onto another page. When it overflows the first page, a warning
  appears in the preview toolbar, and in the terminal during `pnpm pdf`. To fix it, shorten
  `stack`, `expertise` or `contact`.

## ATS compatibility

The PDF text must be readable by applicant tracking systems (ATS). The following choices are
explained in comments in `styles/`, in the rendering code (`src/`) and in `scripts/pdf.ts`:

- **Static fonts**: the Geist and Geist Mono fonts are static instances, one file per weight.
  Chrome embeds variable fonts as Type 3 fonts in PDFs and loses the spaces between words.
- **Reading order**: the main column comes first in the HTML, and the CSS grid displays it on the
  right. No text element uses `position: relative` or `absolute`, because Chrome paints positioned
  elements last, which mixes up the order of the extracted text.
- **Name spacing**: the name has `word-spacing: 0.05em`. With the tight letter spacing of the
  design, PDF extractors would otherwise read the name as a single word.
- **Bullets**: every list item starts with a real, standard bullet `•`, transparent, so an ATS
  reads an ordinary bullet. The visible markers (the chevron in the main column, the triangle in
  the sidebar) are empty elements drawn over it with a CSS mask, so they add no text to the PDF.
- **Date ranges**: the separator is a real ASCII hyphen, transparent, so an ATS reads
  `Apr 2001 - May 2013` and recognizes a period. The arrow is an empty element drawn over it with
  a CSS mask, so it adds no text to the PDF. On screen, only the arrow is visible.
- **Section titles**: the capitals of the section titles are spaced by `0.08em`. PDF extractors
  start a new word when two letters are more than `0.1em` apart, and some pairs of letters would
  cross it with a wider spacing (`EDUCATIO N`).
- **Font hinting**: `pnpm pdf` launches Chrome with `--font-render-hinting=none`. Without it, headless
  Chrome on Linux places the glyphs with font hinting, and PDF extractors split words in two
  (`Regiona l Ma na ger`). The option changes nothing on macOS.

## Project structure

```
data/                   Resume data
  index.ts              Re-exports every data file
  schema.json           JSON Schema of the data, generated from src/schema/
  settings.ts, profile.ts, skills.ts, experience.ts, education.ts, projects.ts
src/
  schema/               Valibot schema of the data, source of the types and of data/schema.json
    index.ts            Assembles the modules into ResumeSchema, exports the types
    shared.ts           Rich text and tag list fields
    settings.ts, profile.ts, skills.ts, experience.ts, education.ts, projects.ts
  main.ts               Page entry point: renders the data of data/index.ts
  render.ts             Renders a resume: fonts, pagination, overflow warning
  render/
    html-fragments.ts   HTML escaping, rich text, lists
    labels.ts           Labels printed on the resume, in French and English
    sidebar.ts          Sidebar blocks
    main-column.ts      Header and main column sections, as blocks
    pagination.ts       Splits the blocks across A4 pages
    sidebar-overflow.ts Measures how much the sidebar overflows
  **/*.test.ts          Unit tests, next to the module they test
scripts/
  pdf.ts                pnpm pdf
  font-check.ts         Fails the PDF generation when a text is drawn with a system font
  generate-schema.ts    pnpm schema
  assert-schema-staged.ts  Pre-commit: fails if src/schema/ has unstaged changes
tests/
  fixtures/             Test resumes, independent of data/
  e2e/                  Tests of the page in Chrome and of the PDF text, as an ATS reads it
index.html              Page served by Vite in the preview and the PDF generation, and built for GitHub Pages
styles.css              Stylesheet entry point: imports every file in styles/
styles/
  fonts.css             Geist and Geist Mono @font-face rules
  base.css              Color and font variables, reset, base elements, drawn characters
  layout.css            Pages, two-column grid, main column flow, A4 format and print
  sidebar.css           Sidebar blocks
  main-column.css       Header and main column sections
  toolbar.css           Preview toolbar, hidden when printing
assets/
  fonts/                Geist and Geist Mono, static instances
vite.config.ts          Vite+ configuration: build, formatting (Oxfmt), lint (Oxlint) and test (Vitest) rules
tsconfig.json           TypeScript projects: tsconfig.app.json (page and data), tsconfig.node.json (scripts),
                        tsconfig.test.json (tests/)
.github/actions/
  setup/                Installs Vite+, Node.js, pnpm and the dependencies, for every workflow
.github/workflows/
  ci.yml                Runs check.yml, then test.yml, on pushes to branches other than main and on pull requests
  check.yml             pnpm check, schema up to date, build
  test.yml              pnpm test
  pages.yml             Deploys the built preview to GitHub Pages from main
.vite-hooks/pre-commit  Git pre-commit hook: vp staged
.puppeteerrc.json       Downloads only chrome-headless-shell
pnpm-workspace.yaml     Allows Puppeteer's install script, points vite and vitest to Vite+, skips the
                        native canvas of pdfjs-dist
```

`out/` holds the generated PDFs and `dist/` the built preview. Neither is tracked by Git.

## Contributing

### Pre-commit hook

`pnpm install` installs a pre-commit hook (`.vite-hooks/pre-commit`), which runs `vp staged` with the `staged` rules
of `vite.config.ts` on the staged files only:

- a change in `src/schema/` regenerates `data/schema.json` and adds it to the commit. The commit fails if
  `src/schema/` also has unstaged changes, which the regenerated file would include without their source;
- `vp check --fix` formats and fixes the staged files, then fails the commit on a remaining lint or type error.

Set `VP_GIT_HOOKS=0` to skip it for one command, or run `vp hooks disable` to turn it off in a clone.

### Branches and pull requests

`main` only changes through pull requests. Rulesets on GitHub enforce it:

- Branch names start with a Conventional Commits type: `feat/`, `fix/`, `refactor/`, `docs/`, `test/`, `ci/`,
  `build/`, `chore/`, `perf/`, `style/` or `revert/`, followed by a short kebab-case name (`fix/date-separator`).
  GitHub rejects the push of a branch named otherwise.
- A pull request can be merged once the `check / check` and `test / test` statuses of the CI pass, the branch is up
  to date with `main`, and every conversation is resolved.
- Pull requests are merged by rebase, so the history of `main` stays linear. Merged branches are deleted.
- Force pushes to `main` and its deletion are blocked.

## License

The code is released under the [MIT License](LICENSE). The Geist and Geist Mono fonts in
`assets/fonts/` are licensed under the [SIL Open Font License 1.1](assets/fonts/OFL.txt).
