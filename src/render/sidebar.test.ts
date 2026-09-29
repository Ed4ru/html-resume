import { describe, expect, it } from 'vite-plus/test';
import { resume } from '../../tests/fixtures/resume.ts';
import type { Resume } from '../schema/index.ts';
import { renderContinuationSidebar, renderFirstPageSidebar } from './sidebar.ts';

const render = (overrides: Partial<Resume> = {}) => renderFirstPageSidebar({ ...resume, ...overrides });

describe('first page sidebar', () => {
  it('links a contact with href, in the accent color when asked', () => {
    const html = render();
    expect(html).toContain('href="mailto:jane@example.com">jane@example.com</a>');
    expect(html).toContain('contact__link--accent" href="https://example.com"');
    expect(html).toContain('<span>Scranton, PA</span>');
  });

  it('uses the labels of the resume language', () => {
    expect(render({ lang: 'fr' })).toContain('// Savoir-faire');
    expect(render()).toContain('// Expertise');
  });

  it('leaves out empty blocks', () => {
    const html = render({ expertise: [], stack: undefined, languages: [] });
    expect(html).not.toContain('Expertise');
    expect(html).not.toContain('Stack');
    expect(html).not.toContain('Languages');
  });

  it('highlights a primary technology', () => {
    const html = render();
    expect(html).toContain('<li class="chips__item chips__item--primary">Prospecting</li>');
    expect(html).toContain('<li class="chips__item">Negotiation</li>');
  });

  it('sizes each language gauge from its value', () => {
    expect(render()).toContain('style="width:40%"');
  });

  it('describes the QR code with its URL', () => {
    const html = render();
    expect(html).toContain('<svg role="img" aria-label="QR code example.com/jane"');
    expect(html).toContain('Online profile');
  });

  it.each([
    ['without qr', { showPrompt: true }],
    ['without url', { showPrompt: true, qr: { label: 'Online profile' } }],
  ])('has no QR code %s', (_, settings) => {
    expect(render({ settings })).not.toContain('<svg');
  });
});

describe('continuation sidebar', () => {
  it('shows the name, the title and the page number', () => {
    const html = renderContinuationSidebar(resume, 3);
    expect(html).toContain(resume.name);
    expect(html).toContain(resume.title);
    expect(html).toContain('// page 3/<span class="page-count__total"></span>');
  });
});
