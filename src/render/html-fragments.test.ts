import { describe, expect, it } from 'vite-plus/test';
import {
  escapeHtml,
  formatDateRange,
  formatRichText,
  formatUrlForDisplay,
  renderIfPresent,
  renderListSeparator,
  renderMarkedList,
  renderTagList,
} from './html-fragments.ts';

// The transparent text under a drawn shape, as ATS parsers read it.
const drawnText = (text: string) => `<span class="drawn-text">${text}</span>`;

describe('escapeHtml', () => {
  it('escapes the five HTML special characters', () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;',
    );
  });
});

describe('formatRichText', () => {
  it('renders **text** in bold', () => {
    expect(formatRichText('a **bold** word')).toBe('a <strong>bold</strong> word');
  });

  it('draws → over a transparent ASCII hyphen', () => {
    const html = formatRichText('from A → B');
    expect(html).toContain(drawnText('-'));
    expect(html).not.toContain('→');
  });

  it('escapes the text before adding markup', () => {
    expect(formatRichText('**<b>**')).toBe('<strong>&lt;b&gt;</strong>');
  });
});

describe('formatDateRange', () => {
  it('separates the dates with a transparent ASCII hyphen', () => {
    const html = formatDateRange('Apr 2001', 'May 2013');
    expect(html.startsWith('Apr 2001 ')).toBe(true);
    expect(html.endsWith(' May 2013')).toBe(true);
    expect(html).toContain(drawnText('-'));
  });

  it('shows the start alone without an end', () => {
    expect(formatDateRange('Apr 2001')).toBe('Apr 2001');
  });

  it('escapes the dates', () => {
    expect(formatDateRange('<2001>')).toBe('&lt;2001&gt;');
  });
});

describe('formatUrlForDisplay', () => {
  it.each([
    ['https://example.com', 'example.com'],
    ['http://www.example.com/', 'example.com'],
    ['https://example.com/blog/', 'example.com/blog'],
    ['example.com', 'example.com'],
  ])('%s → %s', (url, displayed) => {
    expect(formatUrlForDisplay(url)).toBe(displayed);
  });
});

describe('renderIfPresent', () => {
  it.each([undefined, null, '', []])('renders nothing for %j', (value) => {
    expect(renderIfPresent(value, () => 'rendered')).toBe('');
  });

  it('renders a present value', () => {
    expect(renderIfPresent(['a'], (items) => items.join())).toBe('a');
  });
});

describe('renderMarkedList', () => {
  it('starts each item with a transparent standard bullet under the drawn shape', () => {
    const html = renderMarkedList(['one', 'two'], 'bullets', 'chevron', escapeHtml);
    expect(html.match(/<li /g)).toHaveLength(2);
    expect(html.split(drawnText('•'))).toHaveLength(3);
    expect(html).toContain('drawn-shape--chevron');
  });

  it('renders nothing for an empty list', () => {
    expect(renderMarkedList([], 'bullets', 'chevron', escapeHtml)).toBe('');
  });
});

describe('renderTagList', () => {
  it('escapes each tag', () => {
    expect(renderTagList(['C&C'])).toContain('C&amp;C');
  });

  it('renders nothing without tags', () => {
    expect(renderTagList(undefined)).toBe('');
  });

  it('puts a comma after each tag but the last', () => {
    const comma = renderListSeparator(',');
    expect(renderTagList(['B2B sales', 'Paper', 'CRM'])).toBe(
      `<ul class="tags"><li class="tags__item">B2B sales${comma}</li><li class="tags__item">Paper${comma}</li><li class="tags__item">CRM</li></ul>`,
    );
  });
});

describe('renderListSeparator', () => {
  it('renders the punctuation after the text, or before the next one', () => {
    expect(renderListSeparator(',')).toBe('<span class="list-separator">,</span>');
    expect(renderListSeparator('(', 'before')).toBe('<span class="list-separator list-separator--before">(</span>');
  });
});
