import { createSection } from '../section';
import { getCxuiInstance, getSignalValue, setSignalValue, notifyStorybookArgs } from '../../signal-writer';

export function createCopyTextSection(el: Element, onChange: () => void): HTMLDivElement {
  const { root, body } = createSection({ title: 'Content', defaultOpen: true });
  const instance = getCxuiInstance(el);

  const row = document.createElement('div');
  row.className = 'two-col';

  const lbl = document.createElement('div');
  lbl.className = 'control-label';
  lbl.textContent = 'Copy text';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'text-input';
  input.placeholder = 'Text to copy…';
  input.spellcheck = false;
  input.value = instance ? String(getSignalValue(instance, 'value') ?? '') : '';
  input.addEventListener('input', () => {
    if (instance) {
      setSignalValue(el, instance, 'value', input.value);
      notifyStorybookArgs('value', input.value);
    }
    onChange();
  });

  row.append(lbl, input);
  body.appendChild(row);
  return root;
}
