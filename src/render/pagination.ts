const MEASUREMENT_TOLERANCE_PX = 0.5;

const KEEP_WITH_NEXT_ATTRIBUTE = 'data-keep-with-next';

// A split entry keeps its head and at least one list item, so that no title ends a page alone,
// and carries at least two items to the next page, or one when it only has two.
const MIN_ITEMS_KEPT = 1;
const MIN_ITEMS_CARRIED = 2;

export interface Block {
  html: string;
  className?: string;
  keepWithNext?: boolean;
}

interface PageParts {
  firstPageHeader: string;
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

// Chrome writes the text in the order of the DOM, which ATS parsers read: the header of the first
// page, then the sidebar, then the main column. A page that continues a section thus follows the
// previous one, with no sidebar in between. styles/layout.css places them in the grid.
// A transparent period, read as a line of its own at the top of each next page. Parsers that join the
// text of all pages, such as OpenResume, otherwise read the last line of a page and the first line of
// the next one as one line, and miss a section title at the top of a page. A period: neither a bullet,
// a separator nor a title for them.
const PAGE_START_MARK = '<span class="page__start" aria-hidden="true">.</span>';

const appendPage = (container: HTMLElement, sidebarHtml: string, headerHtml?: string) => {
  const page = document.createElement('section');
  page.className = 'page';
  page.innerHTML = `
    <div class="page__layout">
      ${headerHtml ? `<div class="page__header">${headerHtml}</div>` : ''}
      <aside class="page__sidebar${headerHtml ? '' : ' page__sidebar--continued'}">${headerHtml ? '' : PAGE_START_MARK}${sidebarHtml}</aside>
      <main class="page__main${headerHtml ? ' page__main--after-header' : ''}"><div class="page__flow"></div></main>
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

// The rest of a split entry: its carried list items, then its tags, without its head.
const createContinuation = (entry: Element, list: Element, items: readonly Element[], tags: Element | null) => {
  const continuation = entry.cloneNode(false) as Element;
  const body = list.parentElement!.cloneNode(false) as Element;
  const continuedList = list.cloneNode(false) as Element;
  continuedList.append(...items);
  body.append(continuedList, ...(tags ? [tags] : []));
  continuation.append(body);
  continuation.classList.add('entry--continued');
  return continuation;
};

// Leaves on the page as many list items of an entry as fit, and returns the rest of the entry, or
// undefined when it has no list or cannot be split there.
const splitToFit = (page: HTMLElement, entry: Element) => {
  const list = entry.querySelector('.bullets');
  if (!list) return undefined;

  const items = [...list.children];
  const tags = entry.querySelector('.tags');
  tags?.remove();
  const minCarried = items.length > MIN_ITEMS_CARRIED ? MIN_ITEMS_CARRIED : 1;
  for (let keptCount = items.length - minCarried; keptCount >= MIN_ITEMS_KEPT; keptCount--) {
    items.slice(keptCount).forEach((item) => item.remove());
    if (!overflowsPage(page)) return createContinuation(entry, list, items.slice(keptCount), tags);
  }

  list.append(...items);
  if (tags) list.after(tags);
  return undefined;
};

// Moving a block helps only when a block that is not carried along stays on the page.
const canMoveToNextPage = (element: Element) => {
  let previous = element.previousElementSibling;
  while (previous?.hasAttribute(KEEP_WITH_NEXT_ATTRIBUTE)) previous = previous.previousElementSibling;
  return previous !== null;
};

const detachWithKeptPredecessors = (flow: Element, element: Element) => {
  const detached = [element];
  element.remove();
  while (flow.lastElementChild?.hasAttribute(KEEP_WITH_NEXT_ATTRIBUTE)) {
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
  { firstPageHeader, firstPageSidebar, renderContinuationSidebar }: PageParts,
) => {
  let page = appendPage(container, firstPageSidebar, firstPageHeader);
  const startNextPage = () => {
    page = appendPage(container, renderContinuationSidebar(container.children.length + 1));
  };

  // Elements that do not fit go back to the front of the queue, to be laid out on the next page.
  const queue = blocks.map(createBlockElement);
  for (let element = queue.shift(); element; element = queue.shift()) {
    const flow = findPageFlow(page);
    flow.append(element);
    if (!overflowsPage(page)) continue;

    const continuation = splitToFit(page, element);
    if (continuation) {
      startNextPage();
      queue.unshift(continuation);
      continue;
    }

    if (!canMoveToNextPage(element)) continue;

    queue.unshift(...detachWithKeptPredecessors(flow, element));
    startNextPage();
  }

  writePageTotals(container);
};
