const MEASUREMENT_TOLERANCE_PX = 0.5;

const KEEP_WITH_NEXT_ATTRIBUTE = 'data-keep-with-next';

export interface Block {
  html: string;
  className?: string;
  keepWithNext?: boolean;
}

interface Sidebars {
  firstPageSidebar: string;
  renderContinuationSidebar: (pageNumber: number) => string;
}

const createBlockElement = (block: Block) => {
  const template = document.createElement('template');
  template.innerHTML = block.html.trim();
  const element = template.content.firstElementChild!;
  if (block.className) element.classList.add(...block.className.split(' ').filter(Boolean));
  if (block.keepWithNext) element.setAttribute(KEEP_WITH_NEXT_ATTRIBUTE, '');
  return element;
};

const appendPage = (container: HTMLElement, sidebarHtml: string, isContinuation: boolean) => {
  const page = document.createElement('section');
  page.className = 'page';
  page.innerHTML = `
    <div class="page__layout">
      <main class="page__main"><div class="page__flow"></div></main>
      <aside class="page__sidebar${isContinuation ? ' page__sidebar--continued' : ''}">${sidebarHtml}</aside>
    </div>`;
  container.append(page);
  return page;
};

const findPageFlow = (page: HTMLElement) => page.querySelector('.page__flow')!;

const overflowsPage = (page: HTMLElement) => {
  const main = page.querySelector('.page__main')!;
  const contentBottom = main.getBoundingClientRect().bottom - parseFloat(getComputedStyle(main).paddingBottom);
  return findPageFlow(page).getBoundingClientRect().bottom > contentBottom + MEASUREMENT_TOLERANCE_PX;
};

const detachWithKeptPredecessors = (flow: Element, element: Element) => {
  const detached = [element];
  element.remove();
  while (flow.lastElementChild?.hasAttribute(KEEP_WITH_NEXT_ATTRIBUTE) && flow.children.length > 1) {
    detached.unshift(flow.lastElementChild);
    flow.lastElementChild.remove();
  }
  return detached;
};

const writePageTotals = (container: HTMLElement) => {
  const pageCount = String(container.children.length);
  container.querySelectorAll('.page-count__total').forEach((element) => (element.textContent = pageCount));
};

export const paginateIntoPages = (
  container: HTMLElement,
  blocks: readonly Block[],
  { firstPageSidebar, renderContinuationSidebar }: Sidebars,
) => {
  let page = appendPage(container, firstPageSidebar, false);

  for (const block of blocks) {
    const element = createBlockElement(block);
    const flow = findPageFlow(page);
    flow.append(element);

    // A block too tall for an empty page stays: moving it would not help.
    const isAloneOnPage = flow.children.length === 1;
    if (!overflowsPage(page) || isAloneOnPage) continue;

    const carriedElements = detachWithKeptPredecessors(flow, element);
    const nextPageNumber = container.children.length + 1;
    page = appendPage(container, renderContinuationSidebar(nextPageNumber), true);
    findPageFlow(page).append(...carriedElements);
  }

  writePageTotals(container);
};
