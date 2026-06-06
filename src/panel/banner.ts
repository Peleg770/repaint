/**
 * Dismissable banner. Returns an element that callers append to the panel head.
 * Dismissal state is per-element via WeakSet — picking a different element (or
 * navigating away and back) re-shows the banner. The renderer reads
 * `isDismissed(el)` before constructing the banner.
 */
const dismissed = new WeakSet<Element>();

export function isDismissed(el: Element): boolean {
  return dismissed.has(el);
}

export function createWarningBanner(forEl: Element, message: string): HTMLDivElement {
  const banner = document.createElement('div');
  banner.className = 'bvc-banner bvc-banner-warning';

  const text = document.createElement('span');
  text.textContent = message;

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'bvc-banner-close';
  close.setAttribute('aria-label', 'Dismiss warning');
  close.innerHTML = '×';
  close.addEventListener('click', () => {
    dismissed.add(forEl);
    banner.remove();
  });

  banner.append(text, close);
  return banner;
}
