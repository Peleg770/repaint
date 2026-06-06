// src/panel/main.ts
// Generic boot: scan CSS vars from the page, then mount the Panel.

import { Panel } from './panel';
import { Selector } from './selector';
import { scanCssVars } from './css-var-scanner';

export async function boot(): Promise<void> {
  const tokens = scanCssVars();

  const selectorRef: { value: Selector | null } = { value: null };

  const panel = new Panel(tokens, {
    onTogglePick: next => selectorRef.value?.setPicking(next),
    onMutated: () => selectorRef.value?.refresh(),
    onClearSelection: () => selectorRef.value?.clearSelection(),
    onSelectElement: el => {
      selectorRef.value?.setSelection(el);
      panel.renderSelected(el);
    },
    onPreviewElement: el => {
      if (el) selectorRef.value?.previewHover(el);
      else selectorRef.value?.clearPreviewHover();
    },
  });

  selectorRef.value = new Selector(
    {
      onHover: () => {},
      onSelect: el => {
        panel.setPicking(false);
        if (el) panel.renderSelected(el);
        else panel.renderEmpty();
      },
    },
    el => panel.isInPanel(el),
  );

  panel.mount(document.body);
}
