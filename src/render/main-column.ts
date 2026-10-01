import type { Education, EducationItem, Experience, Project, Resume } from '../schema/index.ts';
import {
  escapeHtml,
  formatDateRange,
  formatRichText,
  formatUrlForDisplay,
  renderIfPresent,
  renderMarkedList,
  renderTagList,
} from './html-fragments.ts';
import { getLabels, type Labels } from './labels.ts';
import type { Block } from './pagination.ts';

const PROMPT_LINE =
  '<div class="prompt"><span class="prompt__tilde">~</span> $ whoami<span class="prompt__cursor"></span></div>';

const createHeaderBlock = (resume: Resume): Block => ({
  html: `
    <header class="header${resume.settings.showPrompt ? ' header--with-prompt' : ''}">
      <h1 class="header__name">${escapeHtml(resume.name)}</h1>
      ${resume.settings.showPrompt ? PROMPT_LINE : ''}
      <div class="header__headline">
        <span class="header__title">${escapeHtml(resume.title)}</span>
        ${renderIfPresent(resume.tag, (tag) => `<span class="header__tag">${escapeHtml(tag)}</span>`)}
      </div>
      ${renderIfPresent(resume.summary, (summary) => `<p class="header__summary">${formatRichText(summary)}</p>`)}
    </header>`,
});

const formatSectionNumber = (number: number) => String(number).padStart(2, '0');

const createSectionTitleBlock = (number: number, title: string): Block => ({
  html: `<div class="section-title"><span class="section-title__index">${formatSectionNumber(number)}</span><h2 class="section-title__heading">${escapeHtml(title)}</h2></div>`,
  keepWithNext: true,
});

const renderEntry = ({ head, body }: { head: string; body: string }) => `
  <article class="entry"><div class="entry__body">
    <div class="entry__head">${head}</div>
    ${body}
  </div></article>`;

const formatJobDates = (job: Experience, labels: Labels) =>
  job.current ? formatDateRange(job.start, labels.currentPositionEnd) : formatDateRange(job.start, job.end);

const createExperienceBlock = (job: Experience, labels: Labels): Block => ({
  className: job.current ? 'entry--current' : '',
  splittable: true,
  html: renderEntry({
    head: `<h3 class="entry__title">${escapeHtml(job.role)}</h3><span class="entry__dates">${formatJobDates(job, labels)}</span>`,
    body: `
      <div class="entry__org"><strong>${formatRichText(job.company)}</strong>${renderIfPresent(job.location, (location) => ` · ${escapeHtml(location)}`)}</div>
      ${renderIfPresent(job.context, (context) => `<div class="entry__context">${formatRichText(context)}</div>`)}
      ${renderMarkedList(job.bullets, 'bullets', 'chevron', formatRichText)}
      ${renderTagList(job.stack)}`,
  }),
});

const normalizeEducationItem = (item: EducationItem) => (typeof item === 'string' ? { label: item } : item);

const renderEducationItem = ({ label, note }: { label: string; note?: string }) =>
  `${formatRichText(label)}${renderIfPresent(note, (presentNote) => ` <span class="entry__note">· ${escapeHtml(presentNote)}</span>`)}`;

const createEducationBlock = (educationEntry: Education): Block => ({
  className: 'entry--compact',
  splittable: true,
  html: renderEntry({
    head: `
      <h3 class="entry__title">${escapeHtml(educationEntry.degree)}</h3>
      <span class="entry__dates">${formatDateRange(educationEntry.start, educationEntry.end)}${renderIfPresent(educationEntry.level, (level) => ` · ${escapeHtml(level)}`)}</span>`,
    body: `
      <span class="entry__org">${escapeHtml(educationEntry.school)}</span>
      ${renderMarkedList(educationEntry.items?.map(normalizeEducationItem), 'bullets', 'chevron', renderEducationItem, 'small')}`,
  }),
});

const renderProjectLink = (url: string | undefined) =>
  renderIfPresent(
    url,
    (presentUrl) =>
      `<a class="entry__link" href="${escapeHtml(presentUrl)}">${escapeHtml(formatUrlForDisplay(presentUrl))}</a>`,
  );

const createProjectBlock = (project: Project): Block => ({
  className: 'entry--compact entry--project',
  html: renderEntry({
    head: `
      <span class="entry__name"><h3 class="entry__title">${escapeHtml(project.name)}</h3>${renderProjectLink(project.url)}</span>
      ${renderIfPresent(project.year, (year) => `<span class="entry__dates">${escapeHtml(year)}</span>`)}`,
    body: `
      <span class="entry__description">${formatRichText(project.description)}</span>
      ${renderTagList(project.stack)}`,
  }),
});

interface Section {
  titleLabel: keyof Labels;
  createBlocks: (resume: Resume, labels: Labels) => Block[];
}

const SECTIONS: Section[] = [
  {
    titleLabel: 'experienceSection',
    createBlocks: (resume, labels) => (resume.experience ?? []).map((job) => createExperienceBlock(job, labels)),
  },
  {
    titleLabel: 'educationSection',
    createBlocks: (resume) => (resume.education ?? []).map(createEducationBlock),
  },
  {
    titleLabel: 'projectsSection',
    createBlocks: (resume) => (resume.projects ?? []).map(createProjectBlock),
  },
];

export const buildMainColumnBlocks = (resume: Resume) => {
  const labels = getLabels(resume.lang);
  const filledSections = SECTIONS.map((section) => ({
    title: labels[section.titleLabel],
    blocks: section.createBlocks(resume, labels),
  })).filter((section) => section.blocks.length > 0);

  return [
    createHeaderBlock(resume),
    ...filledSections.flatMap((section, index) => [
      createSectionTitleBlock(index + 1, section.title),
      ...section.blocks,
    ]),
  ];
};
