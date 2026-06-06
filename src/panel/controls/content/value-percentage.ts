import { createSection } from '../section';
import { getCxuiInstance, getSignalValue, setSignalValue, notifyStorybookArgs } from '../../signal-writer';

/**
 * Percentage scrubber, 0–100. Writes to the component's `percentage` input.
 * Distinct from value-number.ts (which targets `value`) because progress-bar
 * names its primary input `percentage` while rolling-number uses `value`.
 */
export function createValuePercentageSection(el: Element, onChange: () => void): HTMLDivElement {
  const { root, body } = createSection({ title: 'Content', defaultOpen: true });
  const instance = getCxuiInstance(el);

  const row = document.createElement('div');
  row.className = 'two-col';

  const lbl = document.createElement('div');
  lbl.className = 'control-label';
  lbl.textContent = 'Percentage';

  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.max = '100';
  input.className = 'text-input';
  input.value = instance ? String(getSignalValue(instance, 'percentage') ?? '') : '';
  input.addEventListener('input', () => {
    const raw = Number(input.value);
    if (instance && Number.isFinite(raw)) {
      const clamped = Math.min(100, Math.max(0, raw));
      setSignalValue(el, instance, 'percentage', clamped);
      notifyStorybookArgs('percentage', clamped);
    }
    onChange();
  });

  row.append(lbl, input);
  body.appendChild(row);
  return root;
}
