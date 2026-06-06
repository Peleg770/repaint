import { createSection } from '../section';
import { getCxuiInstance, getSignalValue, setSignalValue, notifyStorybookArgs } from '../../signal-writer';

export function createValueNumberSection(el: Element, onChange: () => void): HTMLDivElement {
  const { root, body } = createSection({ title: 'Content', defaultOpen: true });
  const instance = getCxuiInstance(el);

  const row = document.createElement('div');
  row.className = 'two-col';

  const lbl = document.createElement('div');
  lbl.className = 'control-label';
  lbl.textContent = 'Value';

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'text-input';
  input.placeholder = 'Numeric value…';
  input.spellcheck = false;
  const current = instance ? getSignalValue(instance, 'value') : undefined;
  input.value = typeof current === 'number' || typeof current === 'string' ? String(current) : '';
  input.addEventListener('input', () => {
    const next = input.value === '' ? 0 : Number(input.value);
    if (instance) {
      setSignalValue(el, instance, 'value', next);
      notifyStorybookArgs('value', next);
    }
    onChange();
  });

  row.append(lbl, input);
  body.appendChild(row);
  return root;
}
