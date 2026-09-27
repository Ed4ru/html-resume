import {
  escapeHtml,
  formatDateRange,
  formatRichText,
  formatUrlForDisplay,
  renderIfPresent,
  renderMarkedList,
  renderTagList,
} from './html-fragments.js';
import { getLabels } from './labels.js';

const PROMPT_LINE = '<div class="prompt"><span class="prompt__tilde">~</span> $ whoami<span class="prompt__cursor"></span></div>';

const createHeaderBlock = (resume) => ({
  html: `
    <header class="header${resume.settings.showPrompt ? ' header--with-prompt' : ''}">
      <h1 class="header__name">${escapeHtml(resume.name)}</h1>
      ${resume.settings.showPrompt ? PROMPT_LINE : ''}
      <div class="header__headline">
        <span class="header__title">${escapeHtml(resume.title)}</span>
        ${renderIfPresent(resume.tag, () => `<span class="header__tag">${escapeHtml(resume.tag)}</span>`)}
      </div>
      ${renderIfPresent(resume.summary, () => `<p class="header__summary">${formatRichText(resume.summary)}</p>`)}
    </header>`,
});

const formatSectionNumber = (number) => String(number).padStart(2, '0');

const createSectionTitleBlock = (number, title) => ({
  html: `<div class="section-title"><span class="section-title__index">${formatSectionNumber(number)}</span><h2 class="section-title__heading">${escapeHtml(title)}</h2></div>`,
  keepWithNext: true,
});

const renderEntry = ({ head, body }) => `
  <article class="entry"><div class="entry__body">
    <div class="entry__head">${head}</div>
    ${body}
  </div></article>`;

const formatJobDates = (job, labels) =>
  job.current ? formatDateRange(job.start, labels.currentPositionEnd) : formatDateRange(job.start, job.end);

const createExperienceBlock = (job, labels) => ({
  className: job.current ? 'entry--current' : '',
  html: renderEntry({
    head: `<h3 class="entry__title">${escapeHtml(job.role)}</h3><span class="entry__dates">${formatJobDates(job, labels)}</span>`,
    body: `
      <div class="entry__org"><strong>${formatRichText(job.company)}</strong>${renderIfPresent(job.location, () => ` · ${escapeHtml(job.location)}`)}</div>
      ${renderIfPresent(job.context, () => `<div class="entry__context">${formatRichText(job.context)}</div>`)}
      ${renderMarkedList(job.bullets, 'bullets', '›')}
      ${renderTagList(job.stack)}`,
  }),
});

const normalizeEducationItem = (item) => (typeof item === 'string' ? { label: item } : item);

const renderEducationItem = ({ label, note }) =>
  `${formatRichText(label)}${renderIfPresent(note, () => ` <span class="entry__note">· ${escapeHtml(note)}</span>`)}`;

const createEducationBlock = (educationEntry) => ({
  className: 'entry--compact',
  html: renderEntry({
    head: `
      <h3 class="entry__title">${escapeHtml(educationEntry.degree)}</h3>
      <span class="entry__dates">${formatDateRange(educationEntry.start, educationEntry.end)}${renderIfPresent(educationEntry.level, () => ` · ${escapeHtml(educationEntry.level)}`)}</span>`,
    body: `
      <span class="entry__org">${escapeHtml(educationEntry.school)}</span>
      ${renderMarkedList(educationEntry.items?.map(normalizeEducationItem), 'bullets', '›', renderEducationItem, 'small')}`,
  }),
});

const renderProjectLink = (url) =>
  renderIfPresent(url, () => `<a class="entry__link" href="${escapeHtml(url)}">${escapeHtml(formatUrlForDisplay(url))}</a>`);

const createProjectBlock = (project) => ({
  className: 'entry--compact entry--project',
  html: renderEntry({
    head: `
      <span class="entry__name"><h3 class="entry__title">${escapeHtml(project.name)}</h3>${renderProjectLink(project.url)}</span>
      ${renderIfPresent(project.year, () => `<span class="entry__dates">${escapeHtml(project.year)}</span>`)}`,
    body: `
      <span class="entry__description">${formatRichText(project.description)}</span>
      ${renderTagList(project.stack)}`,
  }),
});

const SECTIONS = [
  { titleLabel: 'experienceSection', dataKey: 'experience', createBlock: createExperienceBlock },
  { titleLabel: 'educationSection', dataKey: 'education', createBlock: createEducationBlock },
  { titleLabel: 'projectsSection', dataKey: 'projects', createBlock: createProjectBlock },
];

export const buildMainColumnBlocks = (resume) => {
  const labels = getLabels(resume.lang);
  const filledSections = SECTIONS.map((section) => ({
    title: labels[section.titleLabel],
    blocks: (resume[section.dataKey] ?? []).map((entry) => section.createBlock(entry, labels)),
  })).filter((section) => section.blocks.length > 0);

  return [
    createHeaderBlock(resume),
    ...filledSections.flatMap((section, index) => [createSectionTitleBlock(index + 1, section.title), ...section.blocks]),
  ];
};
