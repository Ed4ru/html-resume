const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

type DrawnShape = 'arrow' | 'chevron' | 'triangle';

type ListMarker = Exclude<DrawnShape, 'arrow'>;

// A real character kept as transparent text for ATS parsers, with a shape drawn over it by CSS.
const renderDrawnCharacter = (text: string, shape: DrawnShape) =>
  `<span class="drawn-text">${text}</span><span class="drawn-shape drawn-shape--${shape}"></span>`;

const DATE_ARROW = renderDrawnCharacter('-', 'arrow');

export const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);

// Decorative text, drawn as SVG paths once rendered (src/render/drawn-text.ts): ATS parsers and screen
// readers skip it.
export const DRAWN_ATTRIBUTE = 'data-drawn';
export const DECORATION_ATTRIBUTES = `${DRAWN_ATTRIBUTE} aria-hidden="true"`;

// Drawn text that carries information: screen readers read it as an image with this label.
export const renderDrawnLabelAttributes = (label: string) =>
  `${DRAWN_ATTRIBUTE} role="img" aria-label="${escapeHtml(label)}"`;

export const formatRichText = (text: string) =>
  escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/→/g, DATE_ARROW);

export const formatDateRange = (start: string, end?: string) =>
  `${escapeHtml(start)}${end ? ` ${DATE_ARROW} ${escapeHtml(end)}` : ''}`;

export const formatUrlForDisplay = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

const isEmpty = (value: unknown) => (Array.isArray(value) ? value.length === 0 : !value);

// `value == null` narrows `value` to NonNullable<T>; isEmpty also skips empty arrays and falsy
// values ('', 0, false).
export const renderIfPresent = <T>(value: T, renderFragment: (value: NonNullable<T>) => string) =>
  value == null || isEmpty(value) ? '' : renderFragment(value);

export const renderEach = <T>(items: readonly T[], renderItem: (item: T) => string) => items.map(renderItem).join('');

const formatBlockClasses = (block: string, modifier?: string) => (modifier ? `${block} ${block}--${modifier}` : block);

export const renderList = <T>(
  items: readonly T[] | undefined,
  block: string,
  renderItem: (item: T) => string,
  modifier?: string,
) =>
  renderIfPresent(
    items,
    (presentItems) =>
      `<ul class="${formatBlockClasses(block, modifier)}">${renderEach(presentItems, (item) => `<li class="${block}__item">${renderItem(item)}</li>`)}</ul>`,
  );

// Each marker is a standard bullet (•) that ATS parsers read, under a drawn shape.
export const renderMarkedList = <T>(
  items: readonly T[] | undefined,
  block: string,
  shape: ListMarker,
  renderItem: (item: T) => string,
  modifier?: string,
) =>
  renderList(
    items,
    block,
    (item) =>
      `<span class="${block}__marker">${renderDrawnCharacter('•', shape)}</span><span>${renderItem(item)}</span>`,
    modifier,
  );

// Punctuation between list items for ATS parsers ("B2B sales, Paper"), transparent and without width:
// the list looks the same. Only punctuation: hidden words are a spam signal for ATS. `before` puts it
// before the next text, one character to the left (monospace text).
export const renderListSeparator = (punctuation: string, position: 'after' | 'before' = 'after') =>
  `<span class="list-separator${position === 'before' ? ' list-separator--before' : ''}">${escapeHtml(punctuation)}</span>`;

// Renders each item with a comma after it, except the last one.
export const renderCommaSeparated =
  <T>(renderItem: (item: T, separator: string) => string) =>
  (item: T, index: number, items: readonly T[]) =>
    renderItem(item, index < items.length - 1 ? renderListSeparator(',') : '');

export const renderTagList = (items: readonly string[] | undefined) =>
  renderIfPresent(
    items,
    (presentItems) =>
      `<ul class="tags">${presentItems.map(renderCommaSeparated((item: string, separator) => `<li class="tags__item">${escapeHtml(item)}${separator}</li>`)).join('')}</ul>`,
  );
