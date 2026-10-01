# html-resume

Generates an A4 PDF resume from a JSON data file, rendered with TypeScript, HTML and CSS.

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
pnpm preview --data ~/resume.json   # another data file
pnpm preview --port 8080            # another port
```

- `--data <file>`: the data file, a `.json` file (see [Filling in the data](#filling-in-the-data)), `data/example.json` by
  default.
- `--port <port>`: the port of the server, 5173 by default.
- Other options of `vp dev` are not accepted.

The page reloads by itself after a change to the data file or the code. If the data does not match the schema, the
page shows the errors in Vite's error overlay, one line per field, and reloads once the file is fixed. Press Ctrl+C
to stop the server.

The toolbar at the top of the preview has a **Print / PDF** button that opens the browser's
print dialog.

### PDF

```sh
pnpm pdf
pnpm pdf --data ~/resume.json --out ~/Documents/resume.pdf
```

- `--data <file>`: the data file, a `.json` file, `data/example.json` by default.
- `--out <file>`: the PDF to write, a `.pdf` file, `out/CV-<name>.pdf` by default. Missing directories are created and
  an existing file is overwritten. A directory is refused. The extensions are compared without case (`CV.PDF` is
  accepted).
- `<name>` comes from `name` in the data file, without accents or special characters:
  `Dwight K. Schrute III` gives `out/CV-Dwight-K-Schrute-III.pdf`.
- On success, the command prints the absolute path of the PDF and exits with code 0. On failure, it prints the error
  and exits with code 1.
- It validates the data before starting the browser, and fails without writing a PDF if the data does not match the
  schema. It lists every error, one per line, starting with the path of the field:

  ```
  settings.qr.url: Invalid URL: Received "example.com"
  expertize: unknown field
  name: missing required field
  ```

- The command serves the page with Vite, as the preview does, and waits for it to finish rendering before printing.
- It fails, without writing a PDF, if a file cannot be loaded or if the rendering throws an error.
- It also fails, without writing a PDF, if a character is missing from the fonts in
  `assets/fonts/`: Chrome would draw it with a system font, which changes from one machine to
  another. The message names the character, the text it appears in and the system font.
- It prints a warning if the sidebar overflows the first page (see [Layout](#layout)).

### Paths and other directories

Relative paths given to `--data` and `--out` are resolved from the directory the command is run from. A tool that
runs the commands should pass absolute paths. From another directory, either form works:

```sh
pnpm --dir <repository> pdf --data resume.json
node <repository>/scripts/pdf.ts --data resume.json
```

## Filling in the data

### Data file

The whole resume is one JSON file, passed with `--data`. `data/example.json` is an example: the commands use it when
`--data` is absent, and the build deployed to GitHub Pages always uses it.

| Key                               | Content                                      |
| --------------------------------- | -------------------------------------------- |
| `$schema`                         | Link to `data/schema.json`, for editors      |
| `lang`                            | Language of the labels printed on the resume |
| `settings`                        | Display options: `whoami` line, QR code      |
| `name`, `title`, `tag`, `summary` | Header                                       |
| `contact`                         | Sidebar contact details                      |
| `expertise`, `stack`, `languages` | Sidebar blocks                               |
| `experience`                      | Experience section                           |
| `education`                       | Education section                            |
| `projects`                        | Personal projects section                    |

### Format

- `"$schema"` points to `data/schema.json`, as a path relative to the data file. Editors use it to complete and check
  the file. The rendering ignores it.
- The file replaces the example entirely: nothing is merged with it. A missing optional section is not rendered.
- The schema is strict: an unknown key, such as a misspelled `expertize`, is an error, as is a missing required key.
- The data is validated when it is read: `pnpm pdf` lists the errors and writes nothing, the preview shows them in
  its error overlay. `pnpm check` does not validate the data; `pnpm test` validates `data/example.json`.

The start of a data file (the other required keys are left out):

```json
{
  "$schema": "./schema.json",
  "lang": "en",
  "contact": [{ "label": "email", "value": "jane@example.com", "href": "mailto:jane@example.com" }]
}
```

### Field reference

The schema of the data is written with Valibot in `src/schema/`, one module per part of the resume (settings,
profile, skills, experience, education, projects), assembled by `src/schema/index.ts`. It is the source of truth: the
types used by the rendering code are inferred from it.

`data/schema.json` is generated from it by `pnpm schema`, as a JSON Schema (draft 2020-12). It is the contract with the
tool that writes the data, so it stays in the repository. For every field, it gives the type, whether it is required,
and what it is used for. The CI fails if it is not up to date.

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
data/
  example.json          Example data file, used by default and by the GitHub Pages build
  schema.json           JSON Schema of the data, generated from src/schema/
src/
  schema/               Valibot schema of the data, source of the types and of data/schema.json
    index.ts            Assembles the modules into ResumeSchema, exports the types
    shared.ts           Rich text and tag list fields
    settings.ts, profile.ts, skills.ts, experience.ts, education.ts, projects.ts
  main.ts               Page entry point: renders the data served as virtual:resume-data
  resume-data.d.ts      Type of the virtual:resume-data module
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
  preview.ts            pnpm preview: runs vp dev on the data file
  cli.ts                Command-line arguments and paths of pdf.ts and preview.ts
  resume-data.ts        Reads and validates the data file, Vite plugin serving it as virtual:resume-data
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
tsconfig.json           TypeScript projects: tsconfig.app.json (page), tsconfig.node.json (scripts),
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
