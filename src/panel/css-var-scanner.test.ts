// src/panel/css-var-scanner.test.ts
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import type { ScannedToken } from './css-var-scanner';
import { scanCssVars } from './css-var-scanner';

function setupDom(css: string): void {
  const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, { url: 'http://localhost' });
  (global as unknown as Record<string, unknown>).document = dom.window.document;
  (global as unknown as Record<string, unknown>).window = dom.window;
  (global as unknown as Record<string, unknown>).getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  const style = dom.window.document.createElement('style');
  style.textContent = css;
  dom.window.document.head.appendChild(style);
}

describe('scanCssVars', () => {
  it('returns empty array when no :root custom properties exist', () => {
    setupDom('body { margin: 0; }');
    expect(scanCssVars()).toEqual([]);
  });

  it('extracts color custom properties from :root', () => {
    setupDom(':root { --color-primary: #6366f1; --color-text: #111; --spacing-md: 16px; }');
    const tokens = scanCssVars();
    const names = tokens.map((t: ScannedToken) => t.cssVar);
    expect(names).toContain('--color-primary');
    expect(names).toContain('--color-text');
    expect(names).not.toContain('--spacing-md');
  });

  it('returns correct ScannedToken shape', () => {
    setupDom(':root { --brand: #ff0000; }');
    const tokens = scanCssVars();
    expect(tokens[0]).toMatchObject({
      name: 'brand',
      cssVar: '--brand',
      hex: '#ff0000',
    });
  });

  it('skips non-color custom properties', () => {
    setupDom(':root { --font-size: 16px; --z-index: 100; --easing: ease-in-out; }');
    expect(scanCssVars()).toEqual([]);
  });
});
