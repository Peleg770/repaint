import { createSection } from '../section';
import { getCxuiInstance, getSignalValue, setSignalValue, notifyStorybookArgs } from '../../signal-writer';

export function createNameTextSection(el: Element, onChange: () => void): HTMLDivElement {
  const { root, body } = createSection({ title: 'Content', defaultOpen: true });
  const instance = getCxuiInstance(el);

  const row = document.createElement('div');
  row.className = 'two-col';

  const lbl = document.createElement('div');
  lbl.className = 'control-label';
  lbl.textContent = 'Name';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'text-input';
  input.placeholder = 'Full name…';
  input.spellcheck = false;
  input.value = instance ? String(getSignalValue(instance, 'name') ?? '') : '';
  input.addEventListener('input', () => {
    if (instance) {
      setSignalValue(el, instance, 'name', input.value);
      notifyStorybookArgs('name', input.value);
    }
    onChange();
  });

  row.append(lbl, input);
  body.appendChild(row);
  return root;
}
