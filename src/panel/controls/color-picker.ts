// Token-aware color picker. The trigger reads like a `.value-chip`
// (swatch + label + chevron); clicking it opens a popover with the relevant
// color-token swatches, a search, and a "Custom" footer for raw hex. Picks
// write either `var(--token)` (so the live element stays theme-aware) or a raw
// `#rrggbb` for one-off custom values.

import type { ScannedToken } from '../css-var-scanner';
import { findUsedTokens, groupTokensByPrefix } from '../css-var-scanner';

export interface NarrowedTokens {
  /** Tokens to render in the popover, in display order. */
  list: ScannedToken[];
  /** Current token that fell outside the narrowed set and was appended, or null. */
  offScale: ScannedToken | null;
}

/**
 * Tokens the popover should render given the picker's universe and the
 * element's current colour. Returns the universe, plus any off-scale token
 * already in use (so the picker reflects reality rather than hiding the
 * value). The off-scale token is also returned separately so the renderer can
 * flag its swatch.
 */
export function selectVisibleTokens(
  universe: ScannedToken[],
  current: ScannedToken | null,
): NarrowedTokens {
  const offScale = current && !universe.some(t => t.cssVar === current.cssVar) ? current : null;
  return { list: offScale ? [...universe, offScale] : universe, offScale };
}

interface ColorChipProps {
  // The element this chip drives — read from inline style first (preserves
  // a raw hex or a token var), fall back to computed style.
  el: Element;
  cssProperty: 'backgroundColor' | 'borderColor' | 'color';
  onChange: (rawValue: string) => void;
  // Flat list of scanned tokens to search when resolving the current value.
  tokens: ScannedToken[];
}

export function createColorChip(props: ColorChipProps): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.className = 'color-chip-row';

  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'color-chip';

  const swatch = document.createElement('span');
  swatch.className = 'color-chip-swatch';

  const label = document.createElement('span');
  label.className = 'color-chip-label';

  const chev = document.createElement('span');
  chev.className = 'color-chip-chev';
  chev.innerHTML =
    '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M2.5 3.5 L5 6 L7.5 3.5" stroke="currentColor" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  chip.append(swatch, label, chev);
  wrap.appendChild(chip);

  const refresh = () => {
    const current = readCurrentValue(props.el, props.cssProperty);
    // Search the token list so off-scale tokens (e.g. a var that's used for a
    // different property) still resolve to a named token rather than a raw hex.
    const token = findTokenByCssValue(props.tokens, current.raw);
    if (token) {
      swatch.style.background = token.hex;
      label.textContent = token.cssVar;
      label.title = `${token.cssVar} · ${token.hex}`;
      chip.dataset.kind = 'token';
      delete chip.dataset.offscale;
    } else if (current.hex) {
      swatch.style.background = current.hex;
      label.textContent = current.hex.toUpperCase();
      label.title = current.hex;
      chip.dataset.kind = 'custom';
      delete chip.dataset.offscale;
    } else {
      swatch.dataset.empty = 'true';
      label.textContent = 'none';
      label.title = 'No colour set';
      chip.dataset.kind = 'empty';
      delete chip.dataset.offscale;
    }
  };
  refresh();

  chip.addEventListener('click', () => {
    openColorPopover({
      anchor: chip,
      tokens: props.tokens,
      current: readCurrentValue(props.el, props.cssProperty),
      onPickToken: token => {
        props.onChange(`var(${token.cssVar})`);
        refresh();
      },
      onPickCustom: hex => {
        props.onChange(hex);
        refresh();
      },
    });
  });

  return wrap;
}

interface CurrentValue {
  raw: string; // exact CSS value from inline or computed style
  hex: string | null; // best-effort hex equivalent (null when transparent)
}

function readCurrentValue(el: Element, cssProperty: 'backgroundColor' | 'borderColor' | 'color'): CurrentValue {
  const inline = (el as HTMLElement).style[cssProperty];
  if (inline) {
    return { raw: inline, hex: cssValueToHex(inline) };
  }
  const computed = window.getComputedStyle(el)[cssProperty];
  return { raw: computed, hex: cssValueToHex(computed) };
}

function cssValueToHex(value: string): string | null {
  if (!value || value === 'transparent' || value === 'none') return null;
  const v = value.trim().toLowerCase();
  if (v.startsWith('#')) {
    const m = v.match(/^#([0-9a-f]{3,8})$/i);
    if (!m) return null;
    let body = m[1];
    if (body.length === 3)
      body = body
        .split('')
        .map(c => c + c)
        .join('');
    return '#' + body.slice(0, 6);
  }
  const rgb = v.match(/rgba?\(([^)]+)\)/);
  if (rgb) {
    const parts = rgb[1].split(/[,/\s]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const [r, g, b, a] = parts.map(p => parseFloat(p));
    if ([r, g, b].some(n => Number.isNaN(n))) return null;
    if (typeof a === 'number' && a === 0) return null;
    return '#' + [r, g, b].map(n => Math.round(n).toString(16).padStart(2, '0')).join('');
  }
  // For var(--*) the computed style we read back will already be hex/rgb.
  // For raw named colours we don't try to be clever — return null.
  return null;
}

/**
 * Find a token whose cssVar string (e.g. "var(--color-primary)") matches
 * the given raw CSS value. Returns null if no match.
 */
function findTokenByCssValue(tokens: ScannedToken[], raw: string): ScannedToken | null {
  if (!raw) return null;
  // Match "var(--foo)" style values against token.cssVar (which is "--foo").
  const varMatch = raw.match(/^var\((--[^,)]+)/);
  if (varMatch) {
    const cssVar = varMatch[1];
    return tokens.find(t => t.cssVar === cssVar) ?? null;
  }
  return null;
}

interface OpenPopoverProps {
  anchor: HTMLElement;
  tokens: ScannedToken[];
  current: CurrentValue;
  onPickToken: (token: ScannedToken) => void;
  onPickCustom: (hex: string) => void;
}

function openColorPopover(opts: OpenPopoverProps): void {
  const shadowRoot = opts.anchor.getRootNode() as ShadowRoot;
  const rect = opts.anchor.getBoundingClientRect();

  const overlay = document.createElement('div');
  overlay.className = 'popover-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:auto;';

  const popover = document.createElement('div');
  popover.className = 'popover color-popover';
  popover.style.cssText = `top:${rect.bottom + 6}px;left:${Math.max(8, rect.left)}px;width:300px;max-height:70vh;`;
  popover.addEventListener('click', e => e.stopPropagation());

  const head = document.createElement('div');
  head.className = 'swatch-picker-head';
  head.innerHTML = '<span class="swatch-picker-heading">Pick a colour</span>';

  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'swatch-picker-search';
  search.placeholder = 'Search tokens…';
  search.spellcheck = false;

  const body = document.createElement('div');
  body.className = 'swatch-picker-body';

  popover.append(head, search, body);
  overlay.appendChild(popover);
  shadowRoot.appendChild(overlay);

  const currentToken = findTokenByCssValue(opts.tokens, opts.current.raw);
  const { offScale } = selectVisibleTokens(opts.tokens, currentToken);

  // Compute "on this page" tokens once when popover opens (lazy, ~400 elements).
  const pageTokens = findUsedTokens(opts.tokens);
  const grouped = groupTokensByPrefix(opts.tokens);

  const renderBody = (query: string) => {
    body.innerHTML = '';
    const q = query.trim().toLowerCase();

    if (q) {
      // Search mode: flat results across all tokens
      const filtered = opts.tokens.filter(
        t => t.name.toLowerCase().includes(q) || t.cssVar.toLowerCase().includes(q),
      );
      if (filtered.length > 0) {
        body.appendChild(renderCategory(`Results (${filtered.length})`, filtered, currentToken, opts.onPickToken, overlay, offScale));
      } else {
        const empty = document.createElement('div');
        empty.className = 'swatch-picker-empty';
        empty.textContent = `No tokens match "${q}"`;
        body.appendChild(empty);
      }
    } else {
      // Default: two-section layout
      // Section 1 — On this page
      if (pageTokens.length > 0) {
        body.appendChild(renderCategory('On this page', pageTokens, currentToken, opts.onPickToken, overlay, offScale));
      }
      // Section 2 — All tokens grouped by prefix
      if (opts.tokens.length > 0) {
        if (grouped.length === 1) {
          // Only one group: show flat without a nested heading
          body.appendChild(renderCategory('All tokens', grouped[0].tokens, currentToken, opts.onPickToken, overlay, offScale));
        } else {
          for (const group of grouped) {
            body.appendChild(renderCategory(group.heading, group.tokens, currentToken, opts.onPickToken, overlay, offScale));
          }
        }
      }
    }

    // Custom hex footer — always visible
    body.appendChild(renderCustomFooter(opts.current.hex, opts.onPickCustom, overlay));
  };

  search.addEventListener('input', () => renderBody(search.value));
  overlay.addEventListener('click', () => overlay.remove());
  renderBody('');
  setTimeout(() => search.focus(), 0);
}

function renderCategory(
  heading: string,
  tokens: ScannedToken[],
  current: ScannedToken | null,
  onPick: (token: ScannedToken) => void,
  overlay: HTMLDivElement,
  offScale: ScannedToken | null = null,
): HTMLDivElement {
  const cat = document.createElement('div');
  cat.className = 'swatch-cat';

  const head = document.createElement('div');
  head.className = 'swatch-cat-heading';
  const headText = document.createElement('span');
  headText.textContent = heading;
  const count = document.createElement('span');
  count.className = 'swatch-cat-count';
  count.textContent = String(tokens.length);
  head.append(headText, count);
  cat.appendChild(head);

  const grid = document.createElement('div');
  grid.className = 'swatch-grid';
  for (const t of tokens) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch';
    btn.style.background = t.hex;
    if (current?.cssVar === t.cssVar) btn.dataset.active = 'true';
    let label = `${t.cssVar} · ${t.hex}`;
    if (offScale?.cssVar === t.cssVar) {
      btn.dataset.offscale = 'true';
      label += ` · off-scale`;
    }
    attachSwatchTooltip(btn, label);
    btn.addEventListener('click', () => {
      onPick(t);
      overlay.remove();
    });
    grid.appendChild(btn);
  }
  cat.appendChild(grid);
  return cat;
}

/**
 * Attaches a styled hover tooltip to a swatch. Replaces the native title
 * attribute (slow + system-styled). Pill floats in viewport coords above
 * the swatch with a 200ms delay so brisk mouse traversal between swatches
 * doesn't flash a tooltip on every cell. The element is appended to the
 * panel's shadow root so the panel's CSS applies and the tooltip vanishes
 * if the popover closes mid-hover.
 */
function attachSwatchTooltip(btn: HTMLButtonElement, label: string): void {
  let tip: HTMLDivElement | null = null;
  let showTimer: number | null = null;
  const SHOW_DELAY = 200;

  const hide = (): void => {
    if (showTimer !== null) {
      window.clearTimeout(showTimer);
      showTimer = null;
    }
    tip?.remove();
    tip = null;
  };

  const show = (): void => {
    if (tip) return;
    tip = document.createElement('div');
    tip.className = 'swatch-tooltip';
    tip.textContent = label;
    const r = btn.getBoundingClientRect();
    tip.style.left = `${r.left + r.width / 2}px`;
    tip.style.top = `${r.top}px`;
    (btn.getRootNode() as ShadowRoot).appendChild(tip);
  };

  btn.addEventListener('mouseenter', () => {
    if (showTimer !== null) window.clearTimeout(showTimer);
    showTimer = window.setTimeout(show, SHOW_DELAY);
  });
  btn.addEventListener('mouseleave', hide);
  btn.addEventListener('mousedown', hide);
}

function renderCustomFooter(currentHex: string | null, onPick: (hex: string) => void, overlay: HTMLDivElement): HTMLDivElement {
  const cat = document.createElement('div');
  cat.className = 'swatch-cat color-popover-custom';

  const heading = document.createElement('div');
  heading.className = 'swatch-cat-heading';
  heading.textContent = 'Custom';
  cat.appendChild(heading);

  const row = document.createElement('div');
  row.className = 'color-popover-custom-row';

  const native = document.createElement('input');
  native.type = 'color';
  native.className = 'color-popover-native';
  native.value = currentHex ?? '#000000';

  const hex = document.createElement('input');
  hex.type = 'text';
  hex.className = 'mini-input color-popover-hex';
  hex.maxLength = 7;
  hex.placeholder = '#rrggbb';
  hex.spellcheck = false;
  hex.value = currentHex ?? '';

  const apply = document.createElement('button');
  apply.type = 'button';
  apply.className = 'pick-btn color-popover-apply';
  apply.textContent = 'Apply';

  const tryApply = (raw: string) => {
    const normalized = normaliseHex(raw);
    if (!normalized) return false;
    onPick(normalized);
    overlay.remove();
    return true;
  };

  native.addEventListener('input', () => {
    hex.value = native.value;
  });
  native.addEventListener('change', () => tryApply(native.value));
  hex.addEventListener('input', () => {
    const n = normaliseHex(hex.value);
    if (n) native.value = n;
  });
  hex.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      tryApply(hex.value);
    }
  });
  apply.addEventListener('click', () => tryApply(hex.value));

  row.append(native, hex, apply);
  cat.appendChild(row);
  return cat;
}

function normaliseHex(input: string): string | null {
  const v = input.trim().toLowerCase();
  const withHash = v.startsWith('#') ? v : '#' + v;
  const m = withHash.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (!m) return null;
  let body = m[1];
  if (body.length === 3)
    body = body
      .split('')
      .map(c => c + c)
      .join('');
  return '#' + body;
}
