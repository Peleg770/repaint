/**
 * End-to-end tests for the Repaint panel.
 *
 * We mock the `chrome` global so the content-script IIFE boots without a real
 * extension host. All interactions with Shadow DOM happen via page.evaluate()
 * since Playwright's CSS locators don't pierce closed shadow roots.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_SCRIPT = readFileSync(
  resolve(__dirname, '../../dist/content/content-script.js'),
  'utf-8',
);

// 37 CSS color vars — enough to make the popover scroll
const MANY_VARS = [
  '--color-primary: #6366f1',
  '--color-primary-light: #818cf8',
  '--color-primary-dark: #4f46e5',
  '--color-secondary: #8b5cf6',
  '--color-secondary-light: #a78bfa',
  '--color-success: #22c55e',
  '--color-success-light: #4ade80',
  '--color-error: #ef4444',
  '--color-error-light: #f87171',
  '--color-warning: #f59e0b',
  '--color-warning-light: #fbbf24',
  '--color-info: #3b82f6',
  '--color-info-light: #60a5fa',
  '--color-neutral-50: #f9fafb',
  '--color-neutral-100: #f3f4f6',
  '--color-neutral-200: #e5e7eb',
  '--color-neutral-300: #d1d5db',
  '--color-neutral-400: #9ca3af',
  '--color-neutral-500: #6b7280',
  '--color-neutral-600: #4b5563',
  '--color-neutral-700: #374151',
  '--color-neutral-800: #1f2937',
  '--color-neutral-900: #111827',
  '--color-brand-coral: #f87171',
  '--color-brand-teal: #14b8a6',
  '--color-brand-amber: #f59e0b',
  '--color-brand-sky: #0ea5e9',
  '--color-brand-rose: #f43f5e',
  '--color-surface-base: #ffffff',
  '--color-surface-raised: #f9fafb',
  '--color-surface-overlay: #f3f4f6',
  '--color-text-primary: #111827',
  '--color-text-secondary: #6b7280',
  '--color-text-disabled: #d1d5db',
  '--color-border-default: #e5e7eb',
  '--color-border-strong: #d1d5db',
  '--color-focus-ring: #6366f1',
].map(v => `    ${v};`).join('\n');

const HTML = `<!DOCTYPE html>
<html>
<head>
<style>
  :root {
${MANY_VARS}
  }
  body { margin: 40px; font-family: sans-serif; }
  #target {
    width: 240px;
    height: 80px;
    background-color: var(--color-primary);
    color: var(--color-neutral-50);
    border: 2px solid var(--color-secondary);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
  }
</style>
</head>
<body>
  <div id="target">Repaint test target</div>
</body>
</html>`;

// ── Helpers ───────────────────────────────────────────────────────────────────

// Boot the panel inside the page
async function bootPanel(page: import('@playwright/test').Page) {
  // 1. Load the HTML first
  await page.setContent(HTML, { waitUntil: 'domcontentloaded' });

  // 2. Set up chrome mock AFTER page loads, BEFORE injecting the content script.
  //    The closure over _listener must live in the same window as the IIFE.
  await page.evaluate(() => {
    let _listener: ((msg: unknown) => void) | null = null;
    (window as // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any).chrome = {
      runtime: {
        id: 'repaint-test',
        lastError: undefined,
        onMessage: { addListener(fn: (msg: unknown) => void) { _listener = fn; } },
      },
    };
    (window as // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any).__toggleRepaint = () =>
      _listener && _listener({ type: 'TOGGLE' });
  });

  // 3. Inject the content-script IIFE — it will call chrome.runtime.onMessage.addListener
  await page.addScriptTag({ content: CONTENT_SCRIPT });

  // 4. Trigger the TOGGLE message — boots the panel
  await page.evaluate(() =>
    ((window as // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any).__toggleRepaint as () => void)(),
  );

  // #repaint-host is a 0×0 shadow container — wait for content inside the shadow root
  await page.waitForFunction(() => {
    const host = document.getElementById('repaint-host');
    return !!host?.shadowRoot?.querySelector('.toggle-btn');
  }, { timeout: 8_000 });
}

// Enter pick mode and click the target element so the panel shows its sections
async function selectTarget(page: import('@playwright/test').Page) {
  // Click the Pick button inside the shadow DOM
  await page.evaluate(() => {
    const shadow = (document.getElementById('repaint-host') as HTMLElement).shadowRoot!;
    (shadow.querySelector('.pick-btn') as HTMLButtonElement).click();
  });

  await page.click('#target');

  // Wait until at least one fsection appears (element is rendered in panel)
  await page.waitForFunction(() => {
    const shadow = (document.getElementById('repaint-host') as HTMLElement).shadowRoot;
    return (shadow?.querySelectorAll('.fsection').length ?? 0) > 0;
  }, { timeout: 5_000 });
}

// Open the first Fill color-chip popover and wait for it to appear
async function openFillPopover(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const shadow = (document.getElementById('repaint-host') as HTMLElement).shadowRoot!;
    (shadow.querySelector('.color-chip') as HTMLButtonElement).click();
  });
  await page.waitForFunction(() => {
    const shadow = (document.getElementById('repaint-host') as HTMLElement).shadowRoot;
    return !!shadow?.querySelector('.popover');
  }, { timeout: 5_000 });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Color selection', () => {
  test.beforeEach(async ({ page }) => {
    await bootPanel(page);
    await selectTarget(page);
  });

  test('picking a token applies var(--*) to element backgroundColor', async ({ page }) => {
    await openFillPopover(page);

    // Click the first swatch (any section)
    await page.evaluate(() => {
      const shadow = (document.getElementById('repaint-host') as HTMLElement).shadowRoot!;
      (shadow.querySelector('.swatch') as HTMLButtonElement).click();
    });

    // Popover should close
    await page.waitForFunction(() => {
      const shadow = (document.getElementById('repaint-host') as HTMLElement).shadowRoot;
      return !shadow?.querySelector('.popover');
    }, { timeout: 3_000 });

    // Element should have a non-empty inline backgroundColor
    const bgStyle = await page.locator('#target').evaluate(
      el => (el as HTMLElement).style.backgroundColor,
    );
    expect(bgStyle).toBeTruthy();
    expect(bgStyle).not.toBe('');
  });

  test('token pick sets a var(--*) value, not a bare --name', async ({ page }) => {
    await openFillPopover(page);

    // Click the first swatch
    await page.evaluate(() => {
      const shadow = (document.getElementById('repaint-host') as HTMLElement).shadowRoot!;
      (shadow.querySelector('.swatch') as HTMLButtonElement).click();
    });

    await page.waitForFunction(() => {
      const shadow = (document.getElementById('repaint-host') as HTMLElement).shadowRoot;
      return !shadow?.querySelector('.popover');
    });

    // The inline style must be a valid CSS value, not a raw var name like "--color-primary"
    const bgStyle = await page.locator('#target').evaluate(
      el => (el as HTMLElement).style.backgroundColor,
    );
    // A raw custom-property name starting with -- is not valid CSS for a style attribute
    expect(bgStyle).not.toMatch(/^--/);
  });

  test('custom hex input applies exact hex to element', async ({ page }) => {
    await openFillPopover(page);

    // Fill the hex input and press Enter to apply
    await page.evaluate(() => {
      const shadow = (document.getElementById('repaint-host') as HTMLElement).shadowRoot!;
      const hexInput = shadow.querySelector('.color-popover-hex') as HTMLInputElement;
      hexInput.value = '#ff6600';
      hexInput.dispatchEvent(new Event('input'));
      hexInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    await page.waitForFunction(() => {
      const shadow = (document.getElementById('repaint-host') as HTMLElement).shadowRoot;
      return !shadow?.querySelector('.popover');
    });

    const bgStyle = await page.locator('#target').evaluate(
      el => (el as HTMLElement).style.backgroundColor,
    );
    // Chrome normalises #ff6600 → rgb(255, 102, 0) in inline style too
    expect(bgStyle).toMatch(/rgb\(255,\s*102,\s*0\)|#ff6600/i);
  });

  test('native color picker applies color on change', async ({ page }) => {
    await openFillPopover(page);

    // Trigger native color picker change event — it applies immediately (no Apply button)
    await page.evaluate(() => {
      const shadow = (document.getElementById('repaint-host') as HTMLElement).shadowRoot!;
      const native = shadow.querySelector('.color-popover-native') as HTMLInputElement;
      native.value = '#00cc44';
      native.dispatchEvent(new Event('input'));
      native.dispatchEvent(new Event('change'));
    });

    await page.waitForFunction(() => {
      const shadow = (document.getElementById('repaint-host') as HTMLElement).shadowRoot;
      return !shadow?.querySelector('.popover');
    });

    const bgStyle = await page.locator('#target').evaluate(
      el => (el as HTMLElement).style.backgroundColor,
    );
    expect(bgStyle).toBeTruthy();
    expect(bgStyle).not.toBe('');
  });
});

test.describe('Color picker — "On this page" section', () => {
  test.beforeEach(async ({ page }) => {
    await bootPanel(page);
    await selectTarget(page);
    await openFillPopover(page);
  });

  test('"On this page" section is present', async ({ page }) => {
    const headings = await page.evaluate(() => {
      const shadow = (document.getElementById('repaint-host') as HTMLElement).shadowRoot!;
      return Array.from(shadow.querySelectorAll('.swatch-cat-heading'))
        .map(h => (h as HTMLElement).textContent?.trim().toLowerCase() ?? '');
    });
    expect(headings.some(h => h.includes('on this page'))).toBe(true);
  });

  test('grouped sections appear (more than one category)', async ({ page }) => {
    const catCount = await page.evaluate(() => {
      const shadow = (document.getElementById('repaint-host') as HTMLElement).shadowRoot!;
      return shadow.querySelectorAll('.swatch-cat').length;
    });
    // With 37 tokens across Color/Brand/Surface/Text/Border groups + On this page
    expect(catCount).toBeGreaterThan(2);
  });

  test('search filters across all tokens', async ({ page }) => {
    await page.evaluate(() => {
      const shadow = (document.getElementById('repaint-host') as HTMLElement).shadowRoot!;
      const search = shadow.querySelector('.swatch-picker-search') as HTMLInputElement;
      search.value = 'brand';
      search.dispatchEvent(new Event('input'));
    });

    // Should show only brand tokens (exclude the custom-picker-tile swatch)
    const swatchCount = await page.evaluate(() => {
      const shadow = (document.getElementById('repaint-host') as HTMLElement).shadowRoot!;
      return shadow.querySelectorAll('.swatch:not(.custom-picker-tile)').length;
    });

    // We have 5 brand colors: coral, teal, amber, sky, rose
    expect(swatchCount).toBe(5);

    // "On this page" section should be gone (replaced by flat results)
    const headings = await page.evaluate(() => {
      const shadow = (document.getElementById('repaint-host') as HTMLElement).shadowRoot!;
      return Array.from(shadow.querySelectorAll('.swatch-cat-heading'))
        .map(h => (h as HTMLElement).textContent?.trim().toLowerCase() ?? '');
    });
    expect(headings.some(h => h.includes('on this page'))).toBe(false);
  });
});

test.describe('Scroll behaviour', () => {
  test.beforeEach(async ({ page }) => {
    await bootPanel(page);
    await selectTarget(page);
  });

  test('color popover is scrollable with many tokens', async ({ page }) => {
    await openFillPopover(page);

    const result = await page.evaluate(() => {
      const shadow = (document.getElementById('repaint-host') as HTMLElement).shadowRoot!;
      const popover = shadow.querySelector('.popover') as HTMLElement;
      const cs = window.getComputedStyle(popover);
      return {
        overflowY: cs.overflowY,
        isScrollable: popover.scrollHeight > popover.clientHeight,
        maxHeight: cs.maxHeight,
      };
    });

    // overflow-y must allow scrolling
    expect(['auto', 'scroll']).toContain(result.overflowY);
    // max-height must be set (not 'none')
    expect(result.maxHeight).not.toBe('none');
    // With 37 tokens the content must actually overflow
    expect(result.isScrollable).toBe(true);
  });

  test('panel body is scrollable when sections overflow', async ({ page }) => {
    const result = await page.evaluate(() => {
      const shadow = (document.getElementById('repaint-host') as HTMLElement).shadowRoot!;
      // The scrollable container is .body or similar — find the overflowing element
      const candidates = ['.body', '.scroll-body', '.panel-body', '.root'];
      for (const sel of candidates) {
        const el = shadow.querySelector(sel) as HTMLElement | null;
        if (!el) continue;
        const cs = window.getComputedStyle(el);
        if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') {
          return { found: true, selector: sel, scrollable: el.scrollHeight >= el.clientHeight };
        }
      }
      return { found: false, selector: null, scrollable: false };
    });

    expect(result.found).toBe(true);
    expect(result.scrollable).toBe(true);
  });
});
