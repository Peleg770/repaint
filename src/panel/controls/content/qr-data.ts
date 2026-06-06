import { createSection } from '../section';
import { getCxuiInstance, getSignalValue, setSignalValue, notifyStorybookArgs } from '../../signal-writer';

export function createQrDataSection(el: Element, onChange: () => void): HTMLDivElement {
  const { root, body } = createSection({ title: 'Content', defaultOpen: true });
  const instance = getCxuiInstance(el);

  const row = document.createElement('div');
  row.className = 'two-col';

  const lbl = document.createElement('div');
  lbl.className = 'control-label';
  lbl.textContent = 'Data';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'text-input';
  input.placeholder = 'URL or text…';
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
