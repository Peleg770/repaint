// src/panel/controls/class-editor.ts
// Renders the Classes section: existing class chips (removable) + add-class input.
// Tracks added/removed classes per element so apply.ts can include them in the prompt.

const ADDED_KEY = '__repaintAdded';
const REMOVED_KEY = '__repaintRemoved';

type ElData = Record<string, unknown>;

export interface ClassChanges {
  added: string[];
  removed: string[];
}

export function getClassChanges(el: Element): ClassChanges {
  const data = el as unknown as ElData;
  return {
    added: (data[ADDED_KEY] as string[] | undefined) ?? [],
    removed: (data[REMOVED_KEY] as string[] | undefined) ?? [],
  };
}

export function createClassSection(el: Element, onMutated: () => void): HTMLDivElement {
  const data = el as unknown as ElData;
  data[ADDED_KEY] = [];
  data[REMOVED_KEY] = [];

  const root = document.createElement('div');
  root.style.cssText = 'padding:8px 10px;border-bottom:1px solid #e5e7eb;';

  const label = document.createElement('div');
  label.textContent = 'Classes';
  label.style.cssText = 'font-size:10px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;';
  root.appendChild(label);

  const chips = document.createElement('div');
  chips.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;';
  root.appendChild(chips);

  function renderChips(): void {
    chips.innerHTML = '';
    for (const cls of Array.from(el.classList)) {
      const chip = document.createElement('span');
      chip.setAttribute('data-class-chip', cls);
      chip.style.cssText =
        'display:inline-flex;align-items:center;gap:3px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:4px;' +
        'padding:2px 6px;font-size:11px;font-family:monospace;color:#374151;';
      chip.textContent = cls;

      const rm = document.createElement('span');
      rm.setAttribute('data-remove-class', cls);
      rm.textContent = '×';
      rm.style.cssText = 'cursor:pointer;opacity:0.5;margin-left:2px;font-size:12px;line-height:1;';
      rm.addEventListener('click', () => {
        el.classList.remove(cls);
        trackRemove(el, cls);
        onMutated();
        renderChips();
      });

      chip.appendChild(rm);
      chips.appendChild(chip);
    }
  }

  renderChips();

  const addRow = document.createElement('div');
  addRow.style.cssText = 'display:flex;gap:4px;';

  const input = document.createElement('input');
  input.placeholder = 'Add class…';
  input.style.cssText =
    'flex:1;background:#fff;border:1px solid #d1d5db;border-radius:4px;' +
    'padding:3px 7px;font-size:11px;color:#111827;outline:none;';

  let livePreview = '';
  input.addEventListener('input', () => {
    if (livePreview) el.classList.remove(livePreview);
    livePreview = input.value.trim();
    if (livePreview) el.classList.add(livePreview);
  });

  const addBtn = document.createElement('button');
  addBtn.textContent = 'Add';
  addBtn.style.cssText =
    'background:#6366f1;color:white;border:none;border-radius:4px;' +
    'padding:3px 10px;font-size:11px;cursor:pointer;white-space:nowrap;';

  function commit(): void {
    const cls = input.value.trim();
    if (!cls) return;
    livePreview = '';
    input.value = '';
    if (!el.classList.contains(cls)) {
      el.classList.add(cls);
      trackAdd(el, cls);
      onMutated();
    }
    renderChips();
  }

  addBtn.addEventListener('click', commit);
  input.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape' && livePreview) {
      el.classList.remove(livePreview);
      livePreview = '';
      input.value = '';
    }
  });

  addRow.appendChild(input);
  addRow.appendChild(addBtn);
  root.appendChild(addRow);

  return root;
}

function trackAdd(el: Element, cls: string): void {
  const data = el as unknown as ElData;
  const added = data[ADDED_KEY] as string[];
  const removed = data[REMOVED_KEY] as string[];
  const ri = removed.indexOf(cls);
  if (ri !== -1) { removed.splice(ri, 1); return; }
  if (!added.includes(cls)) added.push(cls);
}

function trackRemove(el: Element, cls: string): void {
  const data = el as unknown as ElData;
  const added = data[ADDED_KEY] as string[];
  const removed = data[REMOVED_KEY] as string[];
  const ai = added.indexOf(cls);
  if (ai !== -1) { added.splice(ai, 1); return; }
  if (!removed.includes(cls)) removed.push(cls);
}
