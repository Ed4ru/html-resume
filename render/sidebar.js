import { renderSVG } from 'uqr';
import { escapeHtml, formatUrlForDisplay, renderEach, renderIfPresent, renderMarkedList } from './html-fragments.js';
import { getLabels } from './labels.js';

const renderSidebarSection = (title, content, modifier) =>
  `<div class="sidebar-section${modifier ? ` sidebar-section--${modifier}` : ''}"><div class="sidebar-section__title">// ${title}</div>${content}</div>`;

const renderContactValue = (contact) =>
  contact.href
    ? `<a class="contact__link${contact.accent ? ' contact__link--accent' : ''}" href="${escapeHtml(contact.href)}">${escapeHtml(contact.value)}</a>`
    : `<span>${escapeHtml(contact.value)}</span>`;

const renderContact = (contact) =>
  `<span class="contact__label">${escapeHtml(contact.label)}</span>${renderContactValue(contact)}`;

const renderContactBlock = (contacts, labels) =>
  renderSidebarSection(labels.contactBlock, `<div class="contact">${renderEach(contacts, renderContact)}</div>`);

const renderExpertiseBlock = (expertise, labels) =>
  renderIfPresent(expertise, () => renderSidebarSection(labels.expertiseBlock, renderMarkedList(expertise, 'expertise', 'triangle')));

const normalizeTechnology = (technology) => (typeof technology === 'string' ? { name: technology } : technology);

const renderTechnologyChip = ({ name, primary }) => `<li class="chips__item${primary ? ' chips__item--primary' : ''}">${escapeHtml(name)}</li>`;

const renderStackLevel = (level) =>
  renderIfPresent(level, () => `<span>${escapeHtml(level)}</span>`);

const renderStackGroup = (group) => `
  <div class="stack__group">
    <div class="stack__label"><span>${escapeHtml(group.label)}</span>${renderStackLevel(group.level)}</div>
    <ul class="chips">${renderEach(group.items.map(normalizeTechnology), renderTechnologyChip)}</ul>
  </div>`;

const renderStackBlock = (stack, labels) =>
  renderIfPresent(stack, () =>
    renderSidebarSection(labels.stackBlock, `<div class="stack">${renderEach(stack, renderStackGroup)}</div>`, 'stack'),
  );

const toGaugePercent = (value) => Number(value) || 0;

const renderLanguage = (language) => `
  <div class="language">
    <div class="language__head"><strong class="language__name">${escapeHtml(language.name)}</strong><span class="language__level">${escapeHtml(language.level)}</span></div>
    <div class="language__gauge"><span class="language__gauge-fill" style="width:${toGaugePercent(language.value)}%"></span></div>
  </div>`;

const renderLanguagesBlock = (languages, labels) =>
  renderIfPresent(languages, () =>
    renderSidebarSection(labels.languagesBlock, `<div class="languages">${renderEach(languages, renderLanguage)}</div>`),
  );

const renderQrCodeSvg = (url) =>
  renderSVG(url, { border: 0, blackColor: 'currentColor', whiteColor: 'transparent' }).replace(
    '<svg ',
    `<svg role="img" aria-label="${escapeHtml(`QR code ${formatUrlForDisplay(url)}`)}" `,
  );

const renderQrCode = (qr) =>
  renderIfPresent(qr?.url, () => `
    <div class="qr">
      <div class="qr__code">${renderQrCodeSvg(qr.url)}</div>
      <div class="qr__text"><span class="qr__caption">&gt; scan_me</span>${renderIfPresent(qr.label, () => `<span class="qr__label">${escapeHtml(qr.label)}</span>`)}</div>
    </div>`);

export const renderFirstPageSidebar = (resume) => {
  const labels = getLabels(resume.lang);
  return [
    renderContactBlock(resume.contact, labels),
    renderExpertiseBlock(resume.expertise, labels),
    renderStackBlock(resume.stack, labels),
    renderLanguagesBlock(resume.languages, labels),
    renderQrCode(resume.settings.qr),
  ].join('');
};

export const renderContinuationSidebar = (resume, pageNumber) => `
  <div class="mini-id"><strong class="mini-id__name">${escapeHtml(resume.name)}</strong><span class="mini-id__title">${escapeHtml(resume.title)}</span></div>
  <span class="page-count">// page ${pageNumber}/<span class="page-count__total"></span></span>
  ${renderQrCode(resume.settings.qr)}`;
