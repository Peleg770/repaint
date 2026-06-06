// src/panel/controls/typography-section.ts
// Figma-style typography controls using the panel's CSS class system.
// Font size and line-height use the scrub pattern (drag handle + number input).
// Weight uses segmented pill buttons. Align uses segmented icon buttons.

import { createSection } from './section';
import { buildScrubInput } from './css-props';

// ── Icons — stroke-based lines, 1.3px stroke ──────────────────────────────────

const ICON_ALIGN_LEFT = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><line x1="2" y1="3.5" x2="12" y2="3.5"/><line x1="2" y1="6.5" x2="9" y2="6.5"/><line x1="2" y1="9.5" x2="11" y2="9.5"/></svg>`;
const ICON_ALIGN_CENTER = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><line x1="2" y1="3.5" x2="12" y2="3.5"/><line x1="3.5" y1="6.5" x2="10.5" y2="6.5"/><line x1="2.5" y1="9.5" x2="11.5" y2="9.5"/></svg>`;
const ICON_ALIGN_RIGHT = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><line x1="2" y1="3.5" x2="12" y2="3.5"/><line x1="5" y1="6.5" x2="12" y2="6.5"/><line x1="3" y1="9.5" x2="12" y2="9.5"/></svg>`;
const ICON_ALIGN_JUSTIFY = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><line x1="2" y1="3.5" x2="12" y2="3.5"/><line x1="2" y1="6.5" x2="12" y2="6.5"/><line x1="2" y1="9.5" x2="8" y2="9.5"/></svg>`;

// ── Section entry point ────────────────────────────────────────────────────────

export function buildTypographySection(el: Element, onChange: () => void): HTMLDivElement {
  const { root, body } = createSection({ title: 'Typography', defaultOpen: true });
  const html = el as HTMLElement;
  const cs = getComputedStyle(html);

  // Row 1: Size (scrub) + Weight (segmented pills)
  body.appendChild(makeSizeWeightRow(cs, html, onChange));

  // Row 2: Line height (scrub) + Align (icon segmented)
  body.appendChild(makeLineHeightAlignRow(cs, html, onChange));

  return root;
}

function makeSizeWeightRow(cs: CSSStyleDeclaration, html: HTMLElement, onChange: () => void): HTMLDivElement {
  const row = document.createElement('div');
  row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;';

  // Size scrub
  const fontSizePx = parseFloat(cs.fontSize) || 16;
  const sizeCell = document.createElement('div');
  sizeCell.style.cssText = 'display:flex;flex-direction:column;gap:3px;';
  const sizeLbl = makeLabel('Size');
  const sizeScrub = buildScrubInput({
    unit: 'px', initial: fontSizePx, min: 1,
    onChange: val => { if (val !== null) { html.style.fontSize = `${val}px`; onChange(); } },
  });
  sizeScrub.root.style.width = '100%';
  sizeCell.append(sizeLbl, sizeScrub.root);

  // Weight segmented pills
  const weightCell = document.createElement('div');
  weightCell.style.cssText = 'display:flex;flex-direction:column;gap:3px;';
  const weightLbl = makeLabel('Weight');
  weightCell.append(weightLbl, makeWeightSegmented(cs.fontWeight, val => { html.style.fontWeight = val; onChange(); }));

  row.append(sizeCell, weightCell);
  return row;
}

function makeLineHeightAlignRow(cs: CSSStyleDeclaration, html: HTMLElement, onChange: () => void): HTMLDivElement {
  const row = document.createElement('div');
  row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;';

  // Line height scrub
  const fontSizePx = parseFloat(cs.fontSize) || 16;
  const lineHeightPx = cs.lineHeight === 'normal'
    ? Math.round(fontSizePx * 1.5)
    : (parseFloat(cs.lineHeight) || Math.round(fontSizePx * 1.5));
  const lhCell = document.createElement('div');
  lhCell.style.cssText = 'display:flex;flex-direction:column;gap:3px;';
  const lhLbl = makeLabel('Line h.');
  const lhScrub = buildScrubInput({
    unit: 'px', initial: lineHeightPx, min: 1,
    onChange: val => { if (val !== null) { html.style.lineHeight = `${val}px`; onChange(); } },
  });
  lhScrub.root.style.width = '100%';
  lhCell.append(lhLbl, lhScrub.root);

  // Align icon segmented
  const alignCell = document.createElement('div');
  alignCell.style.cssText = 'display:flex;flex-direction:column;gap:3px;';
  const alignLbl = makeLabel('Align');
  alignCell.append(alignLbl, makeAlignSegmented(cs.textAlign, val => { html.style.textAlign = val; onChange(); }));

  row.append(lhCell, alignCell);
  return row;
}

function makeLabel(text: string): HTMLDivElement {
  const lbl = document.createElement('div');
  lbl.className = 'control-label';
  lbl.textContent = text;
  return lbl;
}

function makeWeightSegmented(currentWeight: string, onChange: (v: string) => void): HTMLDivElement {
  const weights = ['400', '500', '600', '700', '800'];
  const bar = document.createElement('div');
  bar.className = 'segmented';
  bar.style.cssText = 'width:100%;display:grid;grid-template-columns:repeat(5,1fr);';

  const normalize = (w: string) => (w === 'normal' ? '400' : w === 'bold' ? '700' : w);
  const active = normalize(currentWeight);

  for (const w of weights) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'segmented-btn';
    // Show 4/5/6/7/8 to fit; full weight number in title
    btn.textContent = w.slice(0, 1);
    btn.title = w;
    btn.dataset.value = w;
    btn.dataset.active = w === active ? 'true' : 'false';
    btn.style.cssText = `font-weight:${w};font-size:11px;padding:0;`;
    btn.addEventListener('click', () => {
      bar.querySelectorAll('button').forEach(b => { (b as HTMLButtonElement).dataset.active = 'false'; });
      btn.dataset.active = 'true';
      onChange(w);
    });
    bar.appendChild(btn);
  }
  return bar;
}

function makeAlignSegmented(currentAlign: string, onChange: (v: string) => void): HTMLDivElement {
  const options = [
    { value: 'left',    icon: ICON_ALIGN_LEFT,    title: 'Left' },
    { value: 'center',  icon: ICON_ALIGN_CENTER,  title: 'Center' },
    { value: 'right',   icon: ICON_ALIGN_RIGHT,   title: 'Right' },
    { value: 'justify', icon: ICON_ALIGN_JUSTIFY, title: 'Justify' },
  ];
  const bar = document.createElement('div');
  bar.className = 'segmented';
  bar.style.cssText = 'width:100%;display:grid;grid-template-columns:repeat(4,1fr);';

  const active = (currentAlign || 'left').split(' ')[0];

  for (const opt of options) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'segmented-btn segmented-btn-icon';
    btn.title = opt.title;
    btn.innerHTML = opt.icon;
    btn.dataset.value = opt.value;
    btn.dataset.active = opt.value === active ? 'true' : 'false';
    btn.addEventListener('click', () => {
      bar.querySelectorAll('button').forEach(b => { (b as HTMLButtonElement).dataset.active = 'false'; });
      btn.dataset.active = 'true';
      onChange(opt.value);
    });
    bar.appendChild(btn);
  }
  return bar;
}
