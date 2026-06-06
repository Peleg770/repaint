// Token-aware color picker. The trigger reads like a `.value-chip`
// (swatch + label + chevron); clicking it opens a popover with the relevant
// color-token swatches, a search, and a "Custom" footer for raw hex. Picks
// write either `var(--token)` (so the live element stays theme-aware) or a raw
// `#rrggbb` for one-off custom values.

import type { ScannedToken } from '../css-var-scanner';
import { findUsedTokens, groupTokensByPrefix } from '../css-var-scanner';
import { positionPopover } from '../popover-utils';

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

  const overlay = document.createElement('div');
  overlay.className = 'popover-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:auto;';

  const popover = document.createElement('div');
  popover.className = 'popover color-popover';
  popover.style.width = '300px';
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
  // body scrolls; custom section is rendered outside it so it's always visible

  // Custom section — always sticky at the bottom, outside the scrollable body
  const customSection = renderCustomSection(opts.current.hex, opts.onPickCustom, overlay);

  popover.append(head, search, body, customSection);
  overlay.appendChild(popover);
  shadowRoot.appendChild(overlay);

  // Position after mounting so the browser has the popover's dimensions.
  positionPopover(popover, opts.anchor, 300);

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

    // custom section is outside body (sticky) — nothing to append here
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

function renderCustomSection(currentHex: string | null, onPick: (hex: string) => void, overlay: HTMLDivElement): HTMLDivElement {
  const cat = document.createElement('div');
  cat.className = 'swatch-cat color-popover-custom';

  const heading = document.createElement('div');
  heading.className = 'swatch-cat-heading';
  heading.textContent = 'Custom';
  cat.appendChild(heading);

  // Row: [label wrapping native input + visual tile] [hex text input]
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:6px;';

  // <label> wraps the native input + the visual tile.
  // Clicking anywhere on the label natively opens the OS colour picker —
  // no JS click() needed, works across all browsers and shadow DOM.
  const tileLabel = document.createElement('label');
  tileLabel.title = 'Pick a custom colour';
  tileLabel.style.cssText =
    'position:relative;width:28px;height:28px;flex-shrink:0;display:block;cursor:pointer;border-radius:4px;overflow:hidden;';

  // Native input — full-size inside the label, opacity:0 so it's invisible
  // but fully interactive (browsers always allow user-gesture on visible area)
  const native = document.createElement('input');
  native.type = 'color';
  native.className = 'color-popover-native';
  native.value = currentHex ?? '#6366f1';
  native.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;border:none;padding:0;';

  // Visual tile — sits behind the transparent native input
  const pickerTile = document.createElement('div');
  pickerTile.className = 'custom-picker-tile';
  pickerTile.style.cssText =
    'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
    'border:2px solid var(--bvc-border);border-radius:4px;pointer-events:none;' +
    `background:${currentHex ?? 'conic-gradient(in hsl, red, yellow, lime, cyan, blue, magenta, red)'};`;
  pickerTile.innerHTML =
    '<svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="rgba(255,255,255,0.95)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 1.5px rgba(0,0,0,0.6))">' +
    '<circle cx="7" cy="7" r="5.5"/>' +
    '<circle cx="7" cy="4"   r="1.5" fill="rgba(255,255,255,0.95)" stroke="none"/>' +
    '<circle cx="9.6" cy="8.5" r="1.5" fill="rgba(255,255,255,0.95)" stroke="none"/>' +
    '<circle cx="4.4" cy="8.5" r="1.5" fill="rgba(255,255,255,0.95)" stroke="none"/>' +
    '</svg>';

  tileLabel.append(native, pickerTile);

  // Hex text input — keyboard entry
  const hex = document.createElement('input');
  hex.type = 'text';
  hex.className = 'mini-input color-popover-hex';
  hex.maxLength = 7;
  hex.placeholder = '#rrggbb';
  hex.spellcheck = false;
  hex.value = currentHex ?? '';
  hex.style.cssText = 'flex:1;';

  const applyHex = (raw: string) => {
    const normalized = normaliseHex(raw);
    if (!normalized) return;
    native.value = normalized;
    pickerTile.style.background = normalized;
    onPick(normalized);
    overlay.remove();
  };

  native.addEventListener('input', () => {
    hex.value = native.value;
    pickerTile.style.background = native.value;
  });
  native.addEventListener('change', () => {
    onPick(native.value);
    overlay.remove();
  });

  hex.addEventListener('input', () => {
    const n = normaliseHex(hex.value);
    if (n) { native.value = n; pickerTile.style.background = n; }
  });
  hex.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); applyHex(hex.value); }
  });

  row.append(tileLabel, hex);
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
