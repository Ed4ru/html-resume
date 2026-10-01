const MEASUREMENT_TOLERANCE_PX = 0.5;

const KEEP_WITH_NEXT_ATTRIBUTE = 'data-keep-with-next';
const SPLITTABLE_ATTRIBUTE = 'data-splittable';

// A split entry keeps its head and at least one list item, so that no title ends a page alone,
// and carries at least two items to the next page.
const MIN_ITEMS_KEPT = 1;
const MIN_ITEMS_CARRIED = 2;

export interface Block {
  html: string;
  className?: string;
  keepWithNext?: boolean;
  // An entry that can be split between two list items when it does not fit on the page.
  splittable?: boolean;
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
  if (block.splittable) element.setAttribute(SPLITTABLE_ATTRIBUTE, '');
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

// Leaves on the page as many list items as fit, and returns the rest of the entry, or undefined
// when the entry cannot be split there.
const splitToFit = (page: HTMLElement, entry: Element) => {
  const list = entry.hasAttribute(SPLITTABLE_ATTRIBUTE) ? entry.querySelector('.bullets') : null;
  if (!list) return undefined;

  const items = [...list.children];
  const tags = entry.querySelector('.tags');
  const tagsPosition = tags && { parent: tags.parentElement!, next: tags.nextSibling };
  tags?.remove();
  for (let keptCount = items.length - MIN_ITEMS_CARRIED; keptCount >= MIN_ITEMS_KEPT; keptCount--) {
    items.slice(keptCount).forEach((item) => item.remove());
    if (!overflowsPage(page)) return createContinuation(entry, list, items.slice(keptCount), tags);
  }

  list.append(...items);
  if (tagsPosition) tagsPosition.parent.insertBefore(tags, tagsPosition.next);
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
  { firstPageSidebar, renderContinuationSidebar }: Sidebars,
) => {
  let page = appendPage(container, firstPageSidebar, false);
  const startNextPage = () => {
    page = appendPage(container, renderContinuationSidebar(container.children.length + 1), true);
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

    // A block too tall for an empty page, and not splittable, stays: moving it would not help.
    if (!canMoveToNextPage(element)) continue;

    queue.unshift(...detachWithKeptPredecessors(flow, element));
    startNextPage();
  }

  writePageTotals(container);
};
