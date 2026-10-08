# html-resume

Generates an A4 PDF resume from a JSON data file, rendered with TypeScript, HTML and CSS.
[Preview of the example resume](https://ed4ru.github.io/html-resume/).

Replace the data in `data/example.json` with yours and run `pnpm pdf`. The same page can be previewed and printed
from a browser, and is published to GitHub Pages from `main`: a fork can host its resume online.

## Getting started

Requires Node.js (22.22.1+ on 22.x, 24.11+ on 24.x, or 26+) and pnpm 11.

```sh
pnpm install   # also downloads the headless Chrome that prints the PDF
pnpm preview   # serves the resume at http://localhost:5173, reloaded on every change
pnpm pdf       # writes out/CV-<name>.pdf
```

## Usage

```sh
pnpm preview --data ~/resume.json --port 8080
pnpm pdf --data ~/resume.json --out ~/Documents/resume.pdf
```

- `--data`: the JSON data file, `data/example.json` by default.
- `--out`: the PDF to write, `out/CV-<name>.pdf` by default. `pnpm pdf` prints its absolute path.
- Relative paths are resolved from the directory the command is run from.
- From a script or another tool: `pnpm --dir <repository> pdf --data <file> --out <file>`. It prints the path of the
  PDF, and exits with code 1 on failure.
- Invalid data is reported field by field: in the terminal by `pnpm pdf`, which then writes nothing, and on the page
  by the preview.

| Command       | Result                                                                  |
| ------------- | ----------------------------------------------------------------------- |
| `pnpm check`  | Formatting, lint and type checks                                        |
| `pnpm test`   | Unit tests, then tests of the page and of the PDF in Chrome             |
| `pnpm schema` | Regenerates `data/schema.json` from the Valibot schema in `src/schema/` |
| `pnpm build`  | Builds the preview deployed to GitHub Pages                             |

## Data

One JSON file, validated against `data/schema.json`, which also describes the fields. Edit `data/example.json`, or
keep your file anywhere and pass it with `--data`. Start the file with `"$schema"` and the path to `data/schema.json`
to get completion in editors.

- Required keys: `lang` (`fr` or `en`, the language of the labels printed on the resume), `settings`, `name`, `title`
  and `contact`. A missing optional section is not rendered.
- An unknown key is an error.
- Rich text fields accept `**bold**`, and `→`, drawn as an arrow.

## Layout

The main column flows over as many A4 pages as needed. An experience or education entry that does not fit is
split between two of its list items, keeping at least one with its title and carrying at least two to the next page,
or one when it only has two; otherwise, it moves whole to the next page. The full sidebar only fits on the first page:
when it overflows, the preview and `pnpm pdf` warn about it.

## ATS compatibility

The PDF text is meant to be read by applicant tracking systems: static fonts, the main column first in the reading
order, real bullets and hyphens under the drawn markers, decorations drawn as paths without text (section numbers, `//`,
the `whoami` line, the tag, the QR code caption and the sidebar of the next pages), and spacing that keeps words whole
for PDF extractors. The tests read the PDF as an ATS does. Each choice is explained in comments in `styles/`, `src/` and
`scripts/pdf.ts`.

## Contributing

Issues and pull requests are welcome. For a larger change, open an issue first.

Pull requests are squash-merged. Their title follows [Conventional Commits](https://www.conventionalcommits.org/) and
sets the version bump in `package.json`: major for a breaking change (`!`), minor for `feat`, patch for any other type.
A CI check enforces it.

## License

The code is released under the [MIT License](LICENSE). The Geist and Geist Mono fonts in
`assets/fonts/` are licensed under the [SIL Open Font License 1.1](assets/fonts/OFL.txt).
