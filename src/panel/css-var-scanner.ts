// src/panel/css-var-scanner.ts
// Scans document.styleSheets for :root CSS custom properties that resolve to
// colors. Returns them as ScannedToken[] for use by the color picker.

export interface ScannedToken {
  name: string;    // e.g. "color-primary"  (without leading --)
  cssVar: string;  // e.g. "--color-primary"
  hex: string;     // e.g. "#6366f1"
}

export function scanCssVars(): ScannedToken[] {
  const tokens: ScannedToken[] = [];

  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }

    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSStyleRule)) continue;
      if (!rule.selectorText.includes(':root')) continue;

      for (const prop of Array.from(rule.style)) {
        if (!prop.startsWith('--')) continue;
        const raw = rule.style.getPropertyValue(prop).trim();
        const hex = resolveToHex(prop, raw);
        if (!hex) continue;
        tokens.push({ name: prop.slice(2), cssVar: prop, hex });
      }
    }
  }

  return tokens;
}

function resolveToHex(prop: string, raw: string): string | null {
  if (/^#[0-9a-fA-F]{3,8}$/.test(raw)) return normalizeHex(raw);
  if (raw.startsWith('rgb')) return rgbStringToHex(raw);

  const el = document.createElement('div');
  el.style.color = `var(${prop}, ${raw})`;
  document.body.appendChild(el);
  const computed = getComputedStyle(el).color;
  document.body.removeChild(el);

  if (!computed || computed === 'rgba(0, 0, 0, 0)' || !computed.startsWith('rgb')) return null;
  return rgbStringToHex(computed);
}

function rgbStringToHex(rgb: string): string | null {
  const m = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return null;
  const r = parseInt(m[1]).toString(16).padStart(2, '0');
  const g = parseInt(m[2]).toString(16).padStart(2, '0');
  const b = parseInt(m[3]).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

function normalizeHex(hex: string): string {
  if (hex.length === 4) return '#' + hex[1]+hex[1] + hex[2]+hex[2] + hex[3]+hex[3];
  return hex.slice(0, 7).toLowerCase();
}

/**
 * Scans up to `limit` DOM elements and returns the subset of `tokens` whose
 * hex value appears in any element's computed color, background, or border.
 * Used to power the "On this page" section of the color picker.
 */
export function findUsedTokens(tokens: ScannedToken[], limit = 400): ScannedToken[] {
  if (tokens.length === 0) return [];
  const hexSet = new Set<string>();
  const elements = Array.from(document.querySelectorAll('*')).slice(0, limit);
  for (const el of elements) {
    const cs = getComputedStyle(el);
    for (const prop of ['color', 'backgroundColor', 'borderTopColor'] as const) {
      const val = cs[prop];
      if (!val || val === 'transparent') continue;
      const hex = rgbStringToHex(val);
      if (hex) hexSet.add(hex);
    }
  }
  // Deduplicate: if two tokens share the same hex, only keep the first.
  const seen = new Set<string>();
  return tokens.filter(t => {
    if (!hexSet.has(t.hex) || seen.has(t.hex)) return false;
    seen.add(t.hex);
    return true;
  });
}

/**
 * Groups tokens by a normalized prefix derived from their name.
 * Examples: "--color-primary-500" → "Primary", "--c-text-link" → "Text",
 * "--brand-blue" → "Brand", "--gray-200" → "Gray".
 */
export function groupTokensByPrefix(tokens: ScannedToken[]): Array<{ heading: string; tokens: ScannedToken[] }> {
  const groups = new Map<string, ScannedToken[]>();
  for (const t of tokens) {
    const group = extractGroup(t.name);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(t);
  }
  return Array.from(groups.entries())
    .map(([heading, list]) => ({ heading, tokens: list }))
    .sort((a, b) => a.heading.localeCompare(b.heading));
}

function extractGroup(name: string): string {
  // Strip common design-system prefixes, then take the first meaningful segment.
  let n = name;
  n = n.replace(/^c-/, '');         // --c-text-* (CX)
  n = n.replace(/^color-/, '');     // --color-primary-*
  n = n.replace(/^palette-/, '');   // --palette-blue-*
  n = n.replace(/^ds-/, '');        // --ds-color-*
  const seg = n.split('-')[0] || 'Other';
  return seg.charAt(0).toUpperCase() + seg.slice(1);
}
