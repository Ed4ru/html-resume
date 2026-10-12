import type { Contact, Resume } from '../schema/index.ts';
import {
  DECORATION_ATTRIBUTES,
  escapeHtml,
  formatRichText,
  renderDrawnLabelAttributes,
  renderEach,
  renderIfPresent,
  renderListSeparator,
} from './html-fragments.ts';

const PROMPT_LINE = `<div class="prompt" ${DECORATION_ATTRIBUTES}><span class="prompt__tilde">~</span> $ whoami<span class="prompt__cursor"></span></div>`;

const renderContactValue = (contact: Contact) =>
  contact.href
    ? `<a class="contact__link${contact.accent ? ' contact__link--accent' : ''}" href="${escapeHtml(contact.href)}">${escapeHtml(contact.value)}</a>`
    : `<span>${escapeHtml(contact.value)}</span>`;

// Read by ATS parsers as "email: jane@example.com", one per line, right after the summary. The space is
// part of the separator: the label ends close to its value, and macOS Preview would read no space there.
const renderContact = (contact: Contact) =>
  `<span class="contact__label">${escapeHtml(contact.label)}${renderListSeparator(': ')}</span>${renderContactValue(contact)}`;

const renderPhoto = (resume: Resume) =>
  renderIfPresent(
    resume.photo,
    (photo) =>
      `<img class="masthead__photo" src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.alt ?? resume.name)}">`,
  );

// The band at the top of the first page, across both columns: photo, then name, title and summary,
// then contact details. Read before the sidebar, which is read before the sections
// (src/render/pagination.ts). The name starts left of the sidebar's edge (styles/header.css):
// macOS Preview reads a page column by column, and would read the sidebar first otherwise.
export const buildHeader = (resume: Resume) => `
  <div class="masthead${resume.photo ? ' masthead--with-photo' : ''}">
    ${renderPhoto(resume)}
    <header class="header${resume.settings.showPrompt ? ' header--with-prompt' : ''}">
      <h1 class="header__name">${escapeHtml(resume.name)}</h1>
      ${resume.settings.showPrompt ? PROMPT_LINE : ''}
      <div class="header__headline">
        <span class="header__title">${escapeHtml(resume.title)}</span>
        ${renderIfPresent(resume.tag, (tag) => `<span class="header__tag" ${renderDrawnLabelAttributes(tag)}>${escapeHtml(tag)}</span>`)}
      </div>
      ${renderIfPresent(resume.summary, (summary) => `<p class="header__summary">${formatRichText(summary)}</p>`)}
    </header>
    ${renderIfPresent(resume.contact, (contacts) => `<div class="masthead__contact contact">${renderEach(contacts, renderContact)}</div>`)}
  </div>`;
