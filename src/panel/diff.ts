export interface Snapshot {
  className: string;
  cssText: string;
  text: string;
  disabled: boolean;
  readonly: boolean;
  value?: string;
  placeholder?: string;
  /** icon attribute of the first <cxui-icon> child, null if none. */
  iconChild: string | null;
  /** Variant selections recorded as data-bvc-variant-* attrs at snapshot time. */
  variantAttrs: Record<string, string>;
}

export type Change =
  | { kind: 'class-add'; value: string }
  | { kind: 'class-remove'; value: string }
  | { kind: 'style-add'; prop: string; value: string }
  | { kind: 'style-remove'; prop: string; value: string }
  | { kind: 'style-change'; prop: string; from: string; to: string }
  | { kind: 'text'; from: string; to: string }
  | { kind: 'value'; from: string; to: string }
  | { kind: 'placeholder'; from: string; to: string }
  | { kind: 'attr'; attr: string; from: boolean; to: boolean }
  | { kind: 'icon'; from: string | null; to: string | null }
  | { kind: 'variant'; name: string; from: string; to: string; componentTag: string };

export function takeSnapshot(el: Element): Snapshot {
  const html = el as HTMLElement;
  const tag = el.tagName;
  const isInput = tag === 'INPUT' || tag === 'TEXTAREA';
  const variantAttrs: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith('data-bvc-variant-') && !attr.name.startsWith('data-bvc-variant-classes-')) {
      variantAttrs[attr.name.slice('data-bvc-variant-'.length)] = attr.value;
    }
  }
  const snap: Snapshot = {
    className: el.getAttribute('class') ?? '',
    cssText: html.style.cssText.trim(),
    text: el.textContent ?? '',
    disabled: el.hasAttribute('disabled'),
    iconChild: el.querySelector('cxui-icon')?.getAttribute('icon') ?? null,
    readonly: el.hasAttribute('readonly'),
    variantAttrs,
  };
  if (isInput) {
    const inputEl = el as HTMLInputElement | HTMLTextAreaElement;
    snap.value = inputEl.value ?? '';
    snap.placeholder = inputEl.placeholder ?? '';
  }
  return snap;
}

export function computeChanges(snap: Snapshot, el: Element): Change[] {
  const html = el as HTMLElement;
  const changes: Change[] = [];

  const oldClasses = new Set((snap.className || '').split(/\s+/).filter(Boolean));
  const newClasses = new Set((el.getAttribute('class') || '').split(/\s+/).filter(Boolean));
  for (const c of newClasses) if (!oldClasses.has(c)) changes.push({ kind: 'class-add', value: c });
  for (const c of oldClasses) if (!newClasses.has(c)) changes.push({ kind: 'class-remove', value: c });

  const oldStyles = parseCssText(snap.cssText);
  const newStyles = parseCssText(html.style.cssText.trim());
  const allKeys = new Set([...Object.keys(oldStyles), ...Object.keys(newStyles)]);
  for (const k of allKeys) {
    const o = oldStyles[k];
    const n = newStyles[k];
    if (o === n) continue;
    if (o == null) changes.push({ kind: 'style-add', prop: k, value: n });
    else if (n == null) changes.push({ kind: 'style-remove', prop: k, value: o });
    else changes.push({ kind: 'style-change', prop: k, from: o, to: n });
  }

  const newDisabled = el.hasAttribute('disabled');
  if (snap.disabled !== newDisabled) changes.push({ kind: 'attr', attr: 'disabled', from: snap.disabled, to: newDisabled });

  const newReadonly = el.hasAttribute('readonly');
  if (snap.readonly !== newReadonly) changes.push({ kind: 'attr', attr: 'readonly', from: snap.readonly, to: newReadonly });

  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    const inputEl = el as HTMLInputElement | HTMLTextAreaElement;
    if ((snap.value ?? '') !== (inputEl.value ?? '')) changes.push({ kind: 'value', from: snap.value ?? '', to: inputEl.value ?? '' });
    if ((snap.placeholder ?? '') !== (inputEl.placeholder ?? ''))
      changes.push({ kind: 'placeholder', from: snap.placeholder ?? '', to: inputEl.placeholder ?? '' });
  } else {
    const newText = el.textContent ?? '';
    if (snap.text !== newText) changes.push({ kind: 'text', from: snap.text, to: newText });
  }

  const currentIconChild = el.querySelector('cxui-icon')?.getAttribute('icon') ?? null;
  if (snap.iconChild !== currentIconChild) changes.push({ kind: 'icon', from: snap.iconChild, to: currentIconChild });

  const componentTag = el.tagName.toLowerCase();
  for (const attr of Array.from(el.attributes)) {
    if (!attr.name.startsWith('data-bvc-variant-') || attr.name.startsWith('data-bvc-variant-classes-')) continue;
    const axisName = attr.name.slice('data-bvc-variant-'.length);
    const oldVal = snap.variantAttrs[axisName];
    if (oldVal !== attr.value) {
      changes.push({ kind: 'variant', name: axisName, from: oldVal ?? '', to: attr.value, componentTag });
    }
  }
  for (const [axisName, oldVal] of Object.entries(snap.variantAttrs)) {
    if (!el.hasAttribute(`data-bvc-variant-${axisName}`)) {
      changes.push({ kind: 'variant', name: axisName, from: oldVal, to: '', componentTag });
    }
  }

  return changes;
}

export function parseCssText(cssText: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cssText) return result;
  for (const decl of cssText.split(';')) {
    const trimmed = decl.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const prop = trimmed.slice(0, colonIdx).trim();
    const val = trimmed.slice(colonIdx + 1).trim();
    if (prop) result[prop] = val;
  }
  return result;
}

export function restoreSnapshot(el: Element, snap: Snapshot): void {
  if (snap.className) el.setAttribute('class', snap.className);
  else el.removeAttribute('class');

  const html = el as HTMLElement;
  if (snap.cssText) html.setAttribute('style', snap.cssText);
  else html.removeAttribute('style');

  if (snap.disabled) el.setAttribute('disabled', '');
  else el.removeAttribute('disabled');
  if (snap.readonly) el.setAttribute('readonly', '');
  else el.removeAttribute('readonly');

  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith('data-bvc-variant-') && !attr.name.startsWith('data-bvc-variant-classes-')) el.removeAttribute(attr.name);
  }
  for (const [key, val] of Object.entries(snap.variantAttrs)) {
    el.setAttribute(`data-bvc-variant-${key}`, val);
  }

  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    const input = el as HTMLInputElement | HTMLTextAreaElement;
    if (snap.value != null) input.value = snap.value;
    if (snap.placeholder != null) input.placeholder = snap.placeholder;
  }

  const existingIconEl = el.querySelector('cxui-icon');
  if (snap.iconChild != null) {
    if (existingIconEl) {
      existingIconEl.setAttribute('icon', snap.iconChild);
    } else {
      const iconEl = document.createElement('cxui-icon');
      iconEl.setAttribute('icon', snap.iconChild);
      (iconEl as HTMLElement).style.cssText =
        'display:inline-flex;align-items:center;justify-content:center;width:1em;height:1em;flex-shrink:0;';
      el.insertBefore(iconEl, el.firstChild);
    }
  } else {
    existingIconEl?.remove();
  }
}
