# html-resume

Generates an A4 PDF resume from the data in `data/`, rendered with HTML and CSS.

The PDF is the deliverable. The HTML page is only used to preview the resume in a browser.

The data is written by an external tool. This repository only renders it. The contract between
the two is `data/schema.json`.

## Prerequisites

| Tool                                              | Version  |
| ------------------------------------------------- | -------- |
| [Node.js](https://nodejs.org/)                    | ≥ 22.12  |
| [pnpm](https://pnpm.io/installation)              | 11.25.0  |

The browser used to generate the PDF does not need to be installed manually: `pnpm install`
downloads it (see below).

## Installation

```sh
pnpm install
```

This installs:

- [uqr](https://github.com/unjs/uqr), which generates the QR code. The page loads it from
  `node_modules/` through the import map in `index.html`, so the preview needs it too.
- [Puppeteer](https://pptr.dev/), and downloads `chrome-headless-shell`, the headless Chromium it
  uses, into `~/.cache/puppeteer`.

- `.puppeteerrc.json` limits the download to `chrome-headless-shell` (the full Chrome is skipped).
- The Puppeteer version, and therefore the browser version, is locked by `pnpm-lock.yaml`.

## Usage

| Command        | Result                                                                   |
| -------------- | ------------------------------------------------------------------------ |
| `pnpm preview` | Serves the resume at `http://localhost:8000` and opens it in the browser |
| `pnpm pdf`     | Generates `out/CV-<name>.pdf`                                            |

### Preview

```sh
pnpm preview
PORT=8080 pnpm preview   # use another port
```

Reload the page after changing the data. Press Ctrl+C to stop the server.

The toolbar at the top of the preview has a **Print / PDF** button that opens the browser's
print dialog.

### PDF

```sh
pnpm pdf
```

- `<name>` comes from `name` in `data/profile.js`, without accents or special characters:
  `Dwight K. Schrute III` gives `out/CV-Dwight-K-Schrute-III.pdf`.
- The command waits for the page to finish rendering before printing.
- It fails, without writing a PDF, if a file cannot be loaded or if the rendering throws an error.
- It prints a warning if the sidebar overflows the first page (see [Layout](#layout)).

## Filling in the data

### Files

Each file in `data/` holds part of the resume. `data/index.js` re-exports all of them.

| File                 | Keys                                         |
| -------------------- | -------------------------------------------- |
| `data/settings.js`   | `lang`, `settings`                           |
| `data/profile.js`    | `name`, `title`, `tag`, `summary`, `contact` |
| `data/skills.js`     | `expertise`, `stack`, `languages`            |
| `data/experience.js` | `experience`                                 |
| `data/education.js`  | `education`                                  |
| `data/projects.js`   | `projects`                                   |

### Format

The files are ES modules. Each key is a named export:

```js
export const title = 'Vue.js / Nuxt Developer';

export const contact = [
  { label: 'email', value: 'jane@example.com', href: 'mailto:jane@example.com' },
];
```

### Field reference

`data/schema.json` is a JSON Schema (draft 2020-12) of the full data set. For every field, it
gives the type, whether it is required, the file it belongs to, and what it is used for.

Required keys: `lang`, `settings`, `name`, `title`, `contact`. Every other section is optional
and is not rendered when it is missing or empty.

### Rendering rules

- **Language**: `lang` is `'fr'` or `'en'`. It sets the labels printed on the resume: section
  titles (`Expérience` / `Experience`, `Formation` / `Education`, `Projets persos` /
  `Personal projects`), sidebar titles (`Savoir-faire` / `Expertise`, `Langues` / `Languages`,
  `Contact`, `Stack`) and the end of a current position (`présent` / `present`). The labels are
  defined in `render/labels.js`. The data itself is displayed as written, so it must be written in
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
explained in comments in `styles/` and in the rendering code:

- **Static fonts**: the Geist and Geist Mono fonts are static instances, one file per weight.
  Chrome embeds variable fonts as Type 3 fonts in PDFs and loses the spaces between words.
- **Reading order**: the main column comes first in the HTML, and the CSS grid displays it on the
  right. No text element uses `position: relative` or `absolute`, because Chrome paints positioned
  elements last, which mixes up the order of the extracted text.
- **Name spacing**: the name has `word-spacing: 0.05em`. With the tight letter spacing of the
  design, PDF extractors would otherwise read the name as a single word.
- **Bullets**: the bullet markers `›` and `▸` are real characters, not CSS drawings. An ATS reads
  them as ordinary bullets.
- **Date ranges**: the separator is a real ASCII hyphen, transparent, so an ATS reads
  `Apr 2001 - May 2013` and recognizes a period. The arrow is an empty element drawn over it with
  a CSS mask, so it adds no text to the PDF. On screen, only the arrow is visible.

## Project structure

```
data/                   Resume data
  index.js              Re-exports every data file
  schema.json           JSON Schema of the data
  settings.js, profile.js, skills.js, experience.js, education.js, projects.js
render.js               Rendering entry point: fonts, pagination, overflow warning
render/
  html-fragments.js     HTML escaping, rich text, lists
  labels.js             Labels printed on the resume, in French and English
  sidebar.js            Sidebar blocks
  main-column.js        Header and main column sections, as blocks
  pagination.js         Splits the blocks across A4 pages
  sidebar-overflow.js   Measures how much the sidebar overflows
scripts/
  preview.mjs           pnpm preview
  pdf.mjs               pnpm pdf
  server.mjs            Local static server used by both scripts
index.html              Page loaded by the preview and by the PDF generation, with the import map
styles.css              Stylesheet entry point: imports every file in styles/
styles/
  fonts.css             Geist and Geist Mono @font-face rules
  base.css              Color and font variables, reset, base elements
  layout.css            Pages, two-column grid, main column flow, A4 format and print
  sidebar.css           Sidebar blocks
  main-column.css       Header and main column sections
  toolbar.css           Preview toolbar, hidden when printing
assets/
  fonts/                Geist and Geist Mono, static instances
.puppeteerrc.json       Downloads only chrome-headless-shell
pnpm-workspace.yaml     Allows Puppeteer's install script
```

`out/` holds the generated PDFs and is not tracked by Git.

## License

The code is released under the [MIT License](LICENSE). The Geist and Geist Mono fonts in
`assets/fonts/` are licensed under the [SIL Open Font License 1.1](assets/fonts/OFL.txt).
