import { describe, expect, it } from 'vite-plus/test';
import { resume } from '../../tests/fixtures/resume.ts';
import type { Resume } from '../schema/index.ts';
import { buildMainColumnBlocks } from './main-column.ts';

const render = (overrides: Partial<Resume> = {}) => buildMainColumnBlocks({ ...resume, ...overrides });
const renderHtml = (overrides: Partial<Resume> = {}) =>
  render(overrides)
    .map((block) => block.html)
    .join('');

// Section titles, as "<number> <heading>".
const sectionTitles = (overrides: Partial<Resume> = {}) =>
  render(overrides)
    .filter((block) => block.keepWithNext)
    .map((block) =>
      block.html
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    );

describe('header', () => {
  it('shows the name, title, tag and summary', () => {
    const [header] = render();
    expect(header!.html).toContain(resume.name);
    expect(header!.html).toContain(resume.title);
    expect(header!.html).toContain(resume.tag);
    expect(header!.html).toContain('<strong>ten years</strong>');
  });

  it('shows the whoami line only with showPrompt', () => {
    expect(render()[0]!.html).toContain('whoami');
    expect(render({ settings: { showPrompt: false } })[0]!.html).not.toContain('whoami');
  });

  it('leaves out a missing tag and summary', () => {
    const [header] = render({ tag: undefined, summary: undefined });
    expect(header!.html).not.toContain('header__tag');
    expect(header!.html).not.toContain('header__summary');
  });
});

describe('sections', () => {
  it('numbers the sections in order', () => {
    expect(sectionTitles()).toEqual(['01 Experience', '02 Education', '03 Personal projects']);
  });

  it('leaves out an empty section and renumbers the next ones', () => {
    expect(sectionTitles({ education: [] })).toEqual(['01 Experience', '02 Personal projects']);
    expect(sectionTitles({ experience: undefined })).toEqual(['01 Education', '02 Personal projects']);
  });

  it('keeps each section title with the block after it', () => {
    const blocks = render();
    blocks.forEach((block, index) => {
      if (block.keepWithNext) expect(blocks[index + 1]?.keepWithNext).toBeFalsy();
    });
  });

  it('lets the pagination split experience and education entries only', () => {
    const splittable = render()
      .filter((block) => block.splittable)
      .map((block) => block.html.match(/class="entry__title">([^<]+)</)?.[1]);
    expect(splittable).toEqual([...resume.experience.map((job) => job.role), resume.education[0]!.degree]);
  });

  it('uses the labels of the resume language', () => {
    expect(sectionTitles({ lang: 'fr' })).toEqual(['01 Expérience', '02 Formation', '03 Projets persos']);
  });
});

describe('experience', () => {
  const renderJob = (job: NonNullable<Resume['experience']>[number], lang: Resume['lang'] = 'en') =>
    renderHtml({ lang, experience: [job], education: [], projects: [] });

  it('ends a current position with "present", whatever its end date', () => {
    const job = { role: 'Manager', company: 'Dunder Mifflin', start: 'May 2013', end: 'Jun 2020', current: true };
    expect(renderJob(job)).toContain('present');
    expect(renderJob(job)).not.toContain('Jun 2020');
    expect(renderJob(job, 'fr')).toContain('présent');
  });

  it('shows the start date alone without an end', () => {
    const html = renderJob({ role: 'Salesman', company: 'Staples', start: 'Jun 1999' });
    expect(html).toContain('<span class="entry__dates">Jun 1999</span>');
  });

  it('shows the location, context, bullets and stack', () => {
    const html = renderJob(resume.experience[0]!);
    expect(html).toContain('Scranton, PA');
    expect(html).toContain('Scranton branch of the paper distribution company.');
    expect(html).toContain('<strong>12%</strong>');
    expect(html).toContain('Management');
  });

  it('escapes the texts', () => {
    expect(renderJob({ role: '<Sales>', company: 'A & B', start: '2001' })).toContain('&lt;Sales&gt;');
  });
});

describe('education', () => {
  it('shows string items and items with a note', () => {
    const html = renderHtml({ experience: [], projects: [] });
    expect(html).toContain('Negotiation');
    expect(html).toContain('Key accounts');
    expect(html).toContain('· with honors');
    expect(html).toContain('· Certificate');
  });
});

describe('projects', () => {
  it('links the project and displays its URL without the scheme', () => {
    const html = renderHtml({ experience: [], education: [] });
    expect(html).toContain('href="https://www.example.com/blog/"');
    expect(html).toContain('>example.com/blog</a>');
  });

  it('leaves out a missing link and year', () => {
    const html = renderHtml({ experience: [], education: [], projects: [resume.projects[1]!] });
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('entry__dates');
  });
});
