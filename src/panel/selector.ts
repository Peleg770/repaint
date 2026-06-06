import { outlineCss } from './styles';

export interface SelectorEvents {
  onHover: (el: Element | null) => void;
  onSelect: (el: Element | null) => void;
}

const OUTLINE_LAYER_ID = 'bvc-outline-layer';

export class Selector {
  private layer: HTMLDivElement;
  private hoverOutline: HTMLDivElement;
  private hoverLabel: HTMLDivElement;
  private selectOutline: HTMLDivElement;
  private selectLabel: HTMLDivElement;
  private cursorBadge: HTMLDivElement;

  private picking = false;
  private hovered: Element | null = null;
  private selected: Element | null = null;

  constructor(
    private events: SelectorEvents,
    private isInPanel: (el: Element) => boolean,
  ) {
    this.layer = this.buildLayer();
    document.body.appendChild(this.layer);

    this.hoverOutline = this.buildOutline('hover');
    this.hoverLabel = this.buildLabel();
    this.selectOutline = this.buildOutline('select');
    this.selectLabel = this.buildLabel();
    this.cursorBadge = this.buildCursorBadge();
    this.layer.append(this.hoverOutline, this.hoverLabel, this.selectOutline, this.selectLabel, this.cursorBadge);

    this.hideHover();
    this.hideSelect();
    this.cursorBadge.style.display = 'none';

    document.addEventListener('mousemove', this.onMouseMove, true);
    document.addEventListener('click', this.onClick, true);
    document.addEventListener('keydown', this.onKeyDown, true);
    window.addEventListener('scroll', this.refresh, true);
    window.addEventListener('resize', this.refresh);
  }

  setPicking(on: boolean) {
    this.picking = on;
    if (!on) {
      this.hideHover();
      this.hovered = null;
      this.events.onHover(null);
      this.cursorBadge.style.display = 'none';
    } else {
      this.cursorBadge.style.display = 'block';
      this.cursorBadge.style.top = '-9999px';
      this.cursorBadge.style.left = '-9999px';
    }
    document.documentElement.style.cursor = on ? 'crosshair' : '';
  }

  isPicking() {
    return this.picking;
  }

  clearSelection() {
    this.selected = null;
    this.hideSelect();
    this.events.onSelect(null);
  }

  setSelection(el: Element) {
    this.selected = el;
    this.drawAt(this.selectOutline, this.selectLabel, el);
  }

  previewHover(el: Element) {
    if (this.picking) return;
    this.drawAt(this.hoverOutline, this.hoverLabel, el);
  }

  clearPreviewHover() {
    if (this.picking) return;
    this.hideHover();
  }

  refresh = () => {
    if (this.hovered) this.drawAt(this.hoverOutline, this.hoverLabel, this.hovered);
    if (this.selected) this.drawAt(this.selectOutline, this.selectLabel, this.selected);
  };

  private buildLayer(): HTMLDivElement {
    const layer = document.createElement('div');
    layer.id = OUTLINE_LAYER_ID;
    layer.setAttribute('data-bvc', 'true');
    Object.assign(layer.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '0',
      height: '0',
      pointerEvents: 'none',
      zIndex: '2147483645',
    });
    const style = document.createElement('style');
    style.textContent = outlineCss;
    layer.appendChild(style);
    return layer;
  }

  private buildOutline(mode: 'hover' | 'select'): HTMLDivElement {
    const div = document.createElement('div');
    div.className = 'bvc-outline';
    div.dataset.mode = mode;
    return div;
  }

  private buildLabel(): HTMLDivElement {
    const div = document.createElement('div');
    div.className = 'bvc-label';
    return div;
  }

  private buildCursorBadge(): HTMLDivElement {
    const div = document.createElement('div');
    div.className = 'bvc-cursor-badge';
    div.textContent = 'Esc to cancel';
    return div;
  }

  private onMouseMove = (e: MouseEvent) => {
    if (!this.picking) return;
    this.cursorBadge.style.top = e.clientY + 16 + 'px';
    this.cursorBadge.style.left = e.clientX + 14 + 'px';

    const target = e.target as Element | null;
    if (!target || this.shouldIgnore(target)) {
      this.hideHover();
      this.hovered = null;
      return;
    }
    if (target === this.hovered) return;
    this.hovered = target;
    this.events.onHover(target);
    this.drawAt(this.hoverOutline, this.hoverLabel, target);
  };

  private onClick = (e: MouseEvent) => {
    const target = e.target as Element | null;
    if (!target) return;

    if (this.picking) {
      if (this.shouldIgnore(target)) return;
      e.preventDefault();
      e.stopPropagation();
      this.selected = target;
      this.drawAt(this.selectOutline, this.selectLabel, target);
      this.events.onSelect(target);
      this.setPicking(false);
      return;
    }

    if (!this.selected) return;
    if (this.shouldIgnore(target)) return;
    if (target === this.selected || this.selected.contains(target)) return;
    this.clearSelection();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.picking) {
      this.setPicking(false);
    }
  };

  private shouldIgnore(el: Element): boolean {
    if (el.closest && el.closest(`#${OUTLINE_LAYER_ID}`)) return true;
    if (this.isInPanel(el)) return true;
    return false;
  }

  private drawAt(outline: HTMLDivElement, label: HTMLDivElement, el: Element) {
    const rect = el.getBoundingClientRect();
    Object.assign(outline.style, {
      display: 'block',
      top: rect.top + 'px',
      left: rect.left + 'px',
      width: rect.width + 'px',
      height: rect.height + 'px',
    });
    label.textContent = describeShort(el);
    label.style.display = 'block';
    const labelTop = Math.max(0, rect.top - 18);
    label.style.top = labelTop + 'px';
    label.style.left = rect.left + 'px';
  }

  private hideHover() {
    this.hoverOutline.style.display = 'none';
    this.hoverLabel.style.display = 'none';
  }

  private hideSelect() {
    this.selectOutline.style.display = 'none';
    this.selectLabel.style.display = 'none';
  }
}

function describeShort(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const cls = (el.getAttribute('class') || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(c => `.${c}`)
    .join('');
  return `${tag}${id}${cls}`;
}
