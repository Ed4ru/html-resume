import { drawMarkedText } from './render/drawn-text.ts';
import { buildHeader } from './render/header.ts';
import { buildMainColumnBlocks } from './render/main-column.ts';
import { paginateIntoPages } from './render/pagination.ts';
import { renderContinuationSidebar, renderFirstPageSidebar } from './render/sidebar.ts';
import { measureSidebarOverflow } from './render/sidebar-overflow.ts';
import type { Resume } from './schema/index.ts';

const FONT_WEIGHTS: Record<string, number[]> = {
  Geist: [400, 500, 600, 700, 800],
  'Geist Mono': [400, 500, 600],
};

// Pagination measures text height, so fonts must be loaded first.
const loadFonts = () =>
  Promise.all(
    Object.entries(FONT_WEIGHTS).flatMap(([family, weights]) =>
      weights.map((weight) => document.fonts.load(`${weight} 12px "${family}"`)),
    ),
  );

const applyDocumentMetadata = (resume: Resume) => {
  document.documentElement.lang = resume.lang;
  document.title = `CV ${resume.name} — ${resume.title}`;
  document.querySelector('.toolbar__name')!.textContent = document.title;
};

// Shown in the toolbar of the preview, and printed by scripts/pdf.ts.
const reportWarning = (toolbarText: string, consoleText: string) => {
  const toolbar = document.querySelector('.toolbar__name')!;
  if (!toolbar.querySelector('.toolbar__warning')) toolbar.textContent = '';
  toolbar.insertAdjacentHTML('beforeend', `<span class="toolbar__warning">⚠ ${toolbarText}</span>`);
  console.warn(consoleText);
};

const PHOTO_WARNING_BYTES = 500 * 1024;

// Size of the file behind a base64 data: URL (scripts/resume-data.ts).
const photoBytes = (src: string) => Math.round(((src.length - src.indexOf(',') - 1) * 3) / 4);

const checkPhotoSize = (resume: Resume) => {
  if (!resume.photo?.src.startsWith('data:')) return;
  const kilobytes = Math.round(photoBytes(resume.photo.src) / 1024);
  if (kilobytes * 1024 > PHOTO_WARNING_BYTES) {
    reportWarning(`Photo too heavy: ${kilobytes} KB`, `Photo of ${kilobytes} KB, over 500 KB: compress it`);
  }
};

export const renderResume = async (resume: Resume) => {
  applyDocumentMetadata(resume);
  await loadFonts();

  const container = document.getElementById('cv')!;
  container.innerHTML = '';
  paginateIntoPages(container, buildMainColumnBlocks(resume), {
    firstPageHeader: buildHeader(resume),
    firstPageSidebar: renderFirstPageSidebar(resume),
    renderContinuationSidebar: (pageNumber) => renderContinuationSidebar(resume, pageNumber),
  });
  // After pagination, which writes the sidebars of the next pages. Drawing keeps the size of each
  // element, so the pages do not change.
  await drawMarkedText(container);

  // Printed as soon as data-ready is set: the photo must be decoded by then.
  await Promise.all([...container.querySelectorAll('img')].map((image) => image.decode()));

  const sidebarOverflowPx = measureSidebarOverflow(container);
  if (sidebarOverflowPx > 0) {
    reportWarning(
      'Sidebar too long: shorten stack, expertise or languages',
      `Sidebar too long by ${sidebarOverflowPx} px`,
    );
  }
  checkPhotoSize(resume);

  // Awaited by scripts/pdf.ts before printing.
  document.documentElement.dataset.ready = 'true';
};
