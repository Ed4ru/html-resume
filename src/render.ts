import * as resume from '../data/index.ts';
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

const reportSidebarOverflow = (overflowPx: number) => {
  document.querySelector('.toolbar__name')!.innerHTML =
    '<span class="toolbar__warning">⚠ Sidebar too long: shorten stack, expertise or contact</span>';
  console.warn('Sidebar too long by', overflowPx, 'px');
};

const renderResume = async (resume: Resume) => {
  applyDocumentMetadata(resume);
  await loadFonts();

  const container = document.getElementById('cv')!;
  container.innerHTML = '';
  paginateIntoPages(container, buildMainColumnBlocks(resume), {
    firstPageSidebar: renderFirstPageSidebar(resume),
    renderContinuationSidebar: (pageNumber) => renderContinuationSidebar(resume, pageNumber),
  });

  const sidebarOverflowPx = measureSidebarOverflow(container);
  if (sidebarOverflowPx > 0) reportSidebarOverflow(sidebarOverflowPx);

  // Awaited by scripts/pdf.ts before printing.
  document.documentElement.dataset.ready = 'true';
};

void renderResume(resume);
