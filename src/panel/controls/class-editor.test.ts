// src/panel/controls/class-editor.test.ts
import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { createClassSection, getClassChanges } from './class-editor';

const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, { url: 'http://localhost' });
(global as unknown as Record<string, unknown>).document = dom.window.document;

function makeEl(classes: string): Element {
  const el = dom.window.document.createElement('div');
  el.className = classes;
  dom.window.document.body.appendChild(el);
  return el;
}

describe('createClassSection', () => {
  it('renders a chip for each existing class', () => {
    const el = makeEl('btn btn-primary');
    const section = createClassSection(el, vi.fn());
    const chips = section.querySelectorAll('[data-class-chip]');
    expect(chips).toHaveLength(2);
  });

  it('removes a class when chip × is clicked', () => {
    const el = makeEl('foo bar');
    const onMutated = vi.fn();
    const section = createClassSection(el, onMutated);
    const removeBtn = section.querySelector('[data-remove-class="foo"]') as HTMLElement;
    removeBtn.click();
    expect(el.classList.contains('foo')).toBe(false);
    expect(onMutated).toHaveBeenCalledOnce();
  });
});

describe('getClassChanges', () => {
  it('returns empty when no changes made', () => {
    const el = makeEl('btn');
    createClassSection(el, vi.fn());
    expect(getClassChanges(el)).toEqual({ added: [], removed: [] });
  });

  it('tracks removed classes', () => {
    const el = makeEl('btn btn-primary');
    const section = createClassSection(el, vi.fn());
    (section.querySelector('[data-remove-class="btn-primary"]') as HTMLElement).click();
    expect(getClassChanges(el)).toMatchObject({ removed: ['btn-primary'] });
  });
});
