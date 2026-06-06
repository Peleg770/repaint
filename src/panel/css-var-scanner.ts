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
