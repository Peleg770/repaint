import type { BvcContentKind } from '../../catalog-loader';
import { createIconSection } from '../icon-picker';
import { createTextLabelSection } from '../text-label';

import { createCopyTextSection } from './copy-text';
import { createValueNumberSection } from './value-number';
import { createValuePercentageSection } from './value-percentage';
import { createNameTextSection } from './name-text';
import { createQrDataSection } from './qr-data';

/**
 * Returns the Content section element for the given kind, or null when the kind
 * has no associated creator. The panel only calls this when the catalog entry's
 * bvc.content is set, so a missing case is a bug — we log and return null.
 */
export function createContentSection(kind: BvcContentKind, el: Element, onChange: () => void): HTMLDivElement | null {
  switch (kind) {
    case 'icon':
      return createIconSection(el, onChange);
    case 'text-label':
      return createTextLabelSection(el, onChange);
    case 'copy-text':
      return createCopyTextSection(el, onChange);
    case 'value':
      return createValueNumberSection(el, onChange);
    case 'percentage':
      return createValuePercentageSection(el, onChange);
    case 'name':
      return createNameTextSection(el, onChange);
    case 'qr-data':
      return createQrDataSection(el, onChange);
    default: {
      console.warn('[bvc] unknown content kind:', kind);
      return null;
    }
  }
}
