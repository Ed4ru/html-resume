import { describe, expect, it } from 'vite-plus/test';
import { PHOTO_SRC, resume } from '../../tests/fixtures/resume.ts';
import type { Resume } from '../schema/index.ts';
import { buildHeader } from './header.ts';
import { DECORATION_ATTRIBUTES, renderDrawnLabelAttributes, renderListSeparator } from './html-fragments.ts';

const render = (overrides: Partial<Resume> = {}) => buildHeader({ ...resume, ...overrides });

describe('header', () => {
  it('shows the name, title, tag and summary', () => {
    const header = render();
    expect(header).toContain(resume.name);
    expect(header).toContain(resume.title);
    expect(header).toContain(resume.tag);
    expect(header).toContain('<strong>ten years</strong>');
  });

  it('draws the tag, read by screen readers as an image', () => {
    expect(render()).toContain(`<span class="header__tag" ${renderDrawnLabelAttributes(resume.tag)}>`);
  });

  it('draws the whoami line, only with showPrompt', () => {
    expect(render()).toContain(`<div class="prompt" ${DECORATION_ATTRIBUTES}>`);
    expect(render({ settings: { showPrompt: false } })).not.toContain('whoami');
  });

  it('leaves out a missing tag and summary', () => {
    const header = render({ tag: undefined, summary: undefined });
    expect(header).not.toContain('header__tag');
    expect(header).not.toContain('header__summary');
  });
});

describe('photo', () => {
  it('shows the photo with its text alternative', () => {
    const header = render();
    expect(header).toContain(`<img class="masthead__photo" src="${PHOTO_SRC}" alt="Portrait of Jane">`);
    expect(header).toContain('class="masthead masthead--with-photo"');
  });

  it('describes the photo with the name by default', () => {
    expect(render({ photo: { src: PHOTO_SRC } })).toContain(`alt="${resume.name}"`);
  });

  it('leaves out a missing photo', () => {
    const header = render({ photo: undefined });
    expect(header).not.toContain('<img');
    expect(header).toContain('class="masthead"');
  });
});

describe('contact details', () => {
  it('reads each one as "label: value"', () => {
    expect(render()).toContain(
      `<span class="contact__label">city${renderListSeparator(':')}</span><span>Scranton, PA</span>`,
    );
  });

  it('links a contact with href, in the accent color when asked', () => {
    const header = render();
    expect(header).toContain('href="mailto:jane@example.com">jane@example.com</a>');
    expect(header).toContain('contact__link--accent" href="https://example.com"');
  });

  it('has no title, so that ATS parsers read them with the name', () => {
    expect(render()).not.toMatch(/>\s*Contact\s*</i);
  });

  it('leaves out an empty list', () => {
    expect(render({ contact: [] })).not.toContain('masthead__contact');
  });
});
