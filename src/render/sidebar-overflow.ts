const MEASUREMENT_TOLERANCE_PX = 1;

export const measureSidebarOverflow = (container: HTMLElement) => {
  const firstPageSidebar = container.querySelector('.page__sidebar')!;
  const overflow = firstPageSidebar.scrollHeight - firstPageSidebar.clientHeight;
  return overflow > MEASUREMENT_TOLERANCE_PX ? overflow : 0;
};
