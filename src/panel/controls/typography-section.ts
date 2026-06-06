// src/panel/controls/typography-section.ts
// Free-form typography controls: font-size, font-weight, line-height, text-align.
// No design-system token picker — generic controls work on any element.

import { createSection } from './section';

const ICON_LEFT    = '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="3" width="10" height="1.2" rx="0.4"/><rect x="2" y="6" width="7" height="1.2" rx="0.4"/><rect x="2" y="9" width="9" height="1.2" rx="0.4"/></svg>';
const ICON_CENTER  = '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="3" width="10" height="1.2" rx="0.4"/><rect x="3.5" y="6" width="7" height="1.2" rx="0.4"/><rect x="2.5" y="9" width="9" height="1.2" rx="0.4"/></svg>';
const ICON_RIGHT   = '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="3" width="10" height="1.2" rx="0.4"/><rect x="5" y="6" width="7" height="1.2" rx="0.4"/><rect x="3" y="9" width="9" height="1.2" rx="0.4"/></svg>';
const ICON_JUSTIFY = '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="3" width="10" height="1.2" rx="0.4"/><rect x="2" y="6" width="10" height="1.2" rx="0.4"/><rect x="2" y="9" width="10" height="1.2" rx="0.4"/></svg>';

export function buildTypographySection(el: Element, onChange: () => void): HTMLDivElement {
  const { root, body } = createSection({ title: 'Typography', defaultOpen: true });
  const html = el as HTMLElement;
  const cs = getComputedStyle(html);

  body.appendChild(makeInputRow('Font size', cs.fontSize, val => { html.style.fontSize = val; onChange(); }));
  body.appendChild(makeSelectRow('Weight', cs.fontWeight, ['400', '500', '600', '700', '800'], val => { html.style.fontWeight = val; onChange(); }));
  body.appendChild(makeInputRow('Line height', cs.lineHeight, val => { html.style.lineHeight = val; onChange(); }));

  const aligns = [
    { value: 'left',    icon: ICON_LEFT },
    { value: 'center',  icon: ICON_CENTER },
    { value: 'right',   icon: ICON_RIGHT },
    { value: 'justify', icon: ICON_JUSTIFY },
  ];
  body.appendChild(makeIconRow('Align', cs.textAlign, aligns, val => { html.style.textAlign = val; onChange(); }));

  return root;
}

function makeInputRow(label: string, currentValue: string, onChange: (v: string) => void): HTMLDivElement {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:3px 0;';
  const lbl = document.createElement('span');
  lbl.textContent = label;
  lbl.style.cssText = 'font-size:11px;color:#6b7280;';
  const input = document.createElement('input');
  input.value = currentValue;
  input.style.cssText = 'width:80px;background:#fff;border:1px solid #d1d5db;border-radius:4px;padding:2px 6px;font-size:11px;color:#111827;text-align:right;';
  input.addEventListener('change', () => onChange(input.value));
  row.appendChild(lbl);
  row.appendChild(input);
  return row;
}

function makeSelectRow(label: string, currentValue: string, options: string[], onChange: (v: string) => void): HTMLDivElement {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:3px 0;';
  const lbl = document.createElement('span');
  lbl.textContent = label;
  lbl.style.cssText = 'font-size:11px;color:#6b7280;';
  const select = document.createElement('select');
  select.style.cssText = 'background:#fff;border:1px solid #d1d5db;border-radius:4px;padding:2px 4px;font-size:11px;color:#111827;';
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    o.selected = currentValue === opt || (opt === '400' && currentValue === 'normal') || (opt === '700' && currentValue === 'bold');
    select.appendChild(o);
  }
  select.addEventListener('change', () => onChange(select.value));
  row.appendChild(lbl);
  row.appendChild(select);
  return row;
}

function makeIconRow(
  label: string,
  currentValue: string,
  options: { value: string; icon: string }[],
  onChange: (v: string) => void,
): HTMLDivElement {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:3px 0;';
  const lbl = document.createElement('span');
  lbl.textContent = label;
  lbl.style.cssText = 'font-size:11px;color:#6b7280;';
  const group = document.createElement('div');
  group.style.cssText = 'display:flex;gap:2px;';
  for (const opt of options) {
    const btn = document.createElement('button');
    btn.innerHTML = opt.icon;
    const isActive = currentValue === opt.value;
    btn.style.cssText = `background:${isActive ? '#6366f1' : '#f3f4f6'};color:${isActive ? '#fff' : '#374151'};border:none;border-radius:3px;padding:3px;cursor:pointer;display:flex;align-items:center;`;
    btn.title = opt.value;
    btn.addEventListener('click', () => {
      group.querySelectorAll('button').forEach(b => {
        (b as HTMLElement).style.background = '#f3f4f6';
        (b as HTMLElement).style.color = '#374151';
      });
      btn.style.background = '#6366f1';
      btn.style.color = '#fff';
      onChange(opt.value);
    });
    group.appendChild(btn);
  }
  row.appendChild(lbl);
  row.appendChild(group);
  return row;
}
