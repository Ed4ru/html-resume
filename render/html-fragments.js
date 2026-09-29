const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// A real character kept as transparent text for ATS parsers, with a shape drawn over it by CSS.
const renderDrawnCharacter = (text, shape) =>
  `<span class="drawn-text">${text}</span><span class="drawn-shape drawn-shape--${shape}"></span>`;

const DATE_ARROW = renderDrawnCharacter('-', 'arrow');

export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);

export const formatRichText = (text) =>
  escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/→/g, DATE_ARROW);

export const formatDateRange = (start, end) => `${escapeHtml(start)}${end ? ` ${DATE_ARROW} ${escapeHtml(end)}` : ''}`;

export const formatUrlForDisplay = (url) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

const isPresent = (value) => (Array.isArray(value) ? value.length > 0 : Boolean(value));

export const renderIfPresent = (value, renderFragment) => (isPresent(value) ? renderFragment(value) : '');

export const renderEach = (items, renderItem) => items.map(renderItem).join('');

const formatBlockClasses = (block, modifier) => (modifier ? `${block} ${block}--${modifier}` : block);

export const renderList = (items, block, renderItem = formatRichText, modifier) =>
  renderIfPresent(
    items,
    () =>
      `<ul class="${formatBlockClasses(block, modifier)}">${renderEach(items, (item) => `<li class="${block}__item">${renderItem(item)}</li>`)}</ul>`,
  );

// Each marker is a standard bullet (•) that ATS parsers read, under a drawn shape.
export const renderMarkedList = (items, block, shape, renderItem = formatRichText, modifier) =>
  renderList(
    items,
    block,
    (item) => `<span class="${block}__marker">${renderDrawnCharacter('•', shape)}</span><span>${renderItem(item)}</span>`,
    modifier,
  );

export const renderTagList = (items) => renderList(items, 'tags', escapeHtml);
