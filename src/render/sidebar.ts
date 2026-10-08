import { renderSVG } from 'uqr';
import type { Contact, Language, Qr, Resume, StackGroup, Technology } from '../schema/index.ts';
import {
  DECORATION_ATTRIBUTES,
  escapeHtml,
  formatRichText,
  formatUrlForDisplay,
  renderEach,
  renderIfPresent,
  renderMarkedList,
} from './html-fragments.ts';
import { getLabels, type Labels } from './labels.ts';

const renderSidebarSection = (title: string, content: string, modifier?: string) =>
  `<div class="sidebar-section${modifier ? ` sidebar-section--${modifier}` : ''}"><div class="sidebar-section__title"><span ${DECORATION_ATTRIBUTES}>// </span>${title}</div>${content}</div>`;

const renderContactValue = (contact: Contact) =>
  contact.href
    ? `<a class="contact__link${contact.accent ? ' contact__link--accent' : ''}" href="${escapeHtml(contact.href)}">${escapeHtml(contact.value)}</a>`
    : `<span>${escapeHtml(contact.value)}</span>`;

const renderContact = (contact: Contact) =>
  `<span class="contact__label">${escapeHtml(contact.label)}</span>${renderContactValue(contact)}`;

const renderContactBlock = (contacts: readonly Contact[], labels: Labels) =>
  renderSidebarSection(labels.contactBlock, `<div class="contact">${renderEach(contacts, renderContact)}</div>`);

const renderExpertiseBlock = (expertise: readonly string[] | undefined, labels: Labels) =>
  renderIfPresent(expertise, (items) =>
    renderSidebarSection(labels.expertiseBlock, renderMarkedList(items, 'expertise', 'triangle', formatRichText)),
  );

const normalizeTechnology = (technology: Technology) =>
  typeof technology === 'string' ? { name: technology } : technology;

const renderTechnologyChip = ({ name, primary }: { name: string; primary?: boolean }) =>
  `<li class="chips__item${primary ? ' chips__item--primary' : ''}">${escapeHtml(name)}</li>`;

const renderStackLevel = (level: string | undefined) =>
  renderIfPresent(level, (presentLevel) => `<span>${escapeHtml(presentLevel)}</span>`);

const renderStackGroup = (group: StackGroup) => `
  <div class="stack__group">
    <div class="stack__label"><span>${escapeHtml(group.label)}</span>${renderStackLevel(group.level)}</div>
    <ul class="chips">${renderEach(group.items.map(normalizeTechnology), renderTechnologyChip)}</ul>
  </div>`;

const renderStackBlock = (stack: readonly StackGroup[] | undefined, labels: Labels) =>
  renderIfPresent(stack, (groups) =>
    renderSidebarSection(
      labels.stackBlock,
      `<div class="stack">${renderEach(groups, renderStackGroup)}</div>`,
      'stack',
    ),
  );

const toGaugePercent = (value: number) => value || 0;

const renderLanguage = (language: Language) => `
  <div class="language">
    <div class="language__head"><strong class="language__name">${escapeHtml(language.name)}</strong><span class="language__level">${escapeHtml(language.level)}</span></div>
    <div class="language__gauge"><span class="language__gauge-fill" style="width:${toGaugePercent(language.value)}%"></span></div>
  </div>`;

const renderLanguagesBlock = (languages: readonly Language[] | undefined, labels: Labels) =>
  renderIfPresent(languages, (presentLanguages) =>
    renderSidebarSection(
      labels.languagesBlock,
      `<div class="languages">${renderEach(presentLanguages, renderLanguage)}</div>`,
    ),
  );

const renderQrCodeSvg = (url: string) =>
  renderSVG(url, { border: 0, blackColor: 'currentColor', whiteColor: 'transparent' }).replace(
    '<svg ',
    `<svg role="img" aria-label="${escapeHtml(`QR code ${formatUrlForDisplay(url)}`)}" `,
  );

const renderQrCode = (qr: Qr | undefined) =>
  renderIfPresent(qr, ({ url, label }) =>
    renderIfPresent(
      url,
      (presentUrl) => `
    <div class="qr">
      <div class="qr__code">${renderQrCodeSvg(presentUrl)}</div>
      <div class="qr__text"><span class="qr__caption" ${DECORATION_ATTRIBUTES}>&gt; scan_me</span>${renderIfPresent(label, (presentLabel) => `<span class="qr__label" ${DECORATION_ATTRIBUTES}>${escapeHtml(presentLabel)}</span>`)}</div>
    </div>`,
    ),
  );

export const renderFirstPageSidebar = (resume: Resume) => {
  const labels = getLabels(resume.lang);
  return [
    renderContactBlock(resume.contact, labels),
    renderExpertiseBlock(resume.expertise, labels),
    renderStackBlock(resume.stack, labels),
    renderLanguagesBlock(resume.languages, labels),
    renderQrCode(resume.settings.qr),
  ].join('');
};

export const renderContinuationSidebar = (resume: Resume, pageNumber: number) => `
  <div class="mini-id" ${DECORATION_ATTRIBUTES}><strong class="mini-id__name">${escapeHtml(resume.name)}</strong><span class="mini-id__title">${escapeHtml(resume.title)}</span></div>
  <span class="page-count" ${DECORATION_ATTRIBUTES}>// page ${pageNumber}/<span class="page-count__total"></span></span>
  ${renderQrCode(resume.settings.qr)}`;
