import { panelCss, PANEL_WIDTH } from './styles';
import { createClassSection, getClassChanges } from './controls/class-editor';
import { createLayoutSections, createVisualSections } from './controls/css-props';
import { buildTypographySection } from './controls/typography-section';
import { buildSessionPrompt, copyToClipboard, postApply } from './apply';
import { computeChanges, restoreSnapshot, takeSnapshot, type Change, type Snapshot } from './diff';
import type { ScannedToken } from './css-var-scanner';

export interface PanelHandlers {
  onTogglePick: (next: boolean) => void;
  onMutated?: () => void;
  onClearSelection?: () => void;
  onSelectElement?: (el: Element) => void;
  onPreviewElement?: (el: Element | null) => void;
}

export class Panel {
  readonly host: HTMLDivElement;
  readonly shadow: ShadowRoot;
  private root: HTMLDivElement;
  private targetStrip: HTMLDivElement;
  private body: HTMLDivElement;
  private pickBtn: HTMLButtonElement;
  private applyBtn!: HTMLButtonElement;
  private toggleBtn!: HTMLButtonElement;
  private closeBtn!: HTMLButtonElement;
  private changesEl!: HTMLDivElement;
  private changesTitleText!: HTMLSpanElement;
  private changesList!: HTMLUListElement;
  private resetBtn!: HTMLButtonElement;
  private picking = false;
  private open = false;
  private currentEl: Element | null = null;
  private snapshots: Map<Element, Snapshot> = new Map();
  private lastSentAt: number | null = null;
  private sentLabel!: HTMLDivElement;
  private sentLabelTimer: number | null = null;

  constructor(private tokens: ScannedToken[], private handlers: PanelHandlers) {
    this.host = document.createElement('div');
    this.host.id = 'repaint-host';
    this.host.setAttribute('data-repaint', 'true');
    Object.assign(this.host.style, {
      position: 'fixed',
      top: '0',
      right: '0',
      width: '0',
      height: '0',
      zIndex: '2147483646',
    });
    this.shadow = this.host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = panelCss;
    this.shadow.appendChild(style);

    this.toggleBtn = document.createElement('button');
    this.toggleBtn.className = 'toggle-btn';
    this.toggleBtn.title = 'Open / close Repaint (⌘. or ⌘\\)';
    this.toggleBtn.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<rect x="3" y="4" width="18" height="16" rx="3"/>' +
      '<line x1="7" y1="9" x2="17" y2="9"/>' +
      '<line x1="7" y1="14" x2="13" y2="14"/>' +
      '<circle cx="15" cy="14" r="1.5" fill="currentColor"/>' +
      '</svg>';
    this.toggleBtn.addEventListener('click', () => this.setOpen(!this.open));
    this.shadow.appendChild(this.toggleBtn);

    this.root = document.createElement('div');
    this.root.className = 'root';
    this.shadow.appendChild(this.root);

    // Two-row sticky header. Row 1 holds the Repaint mark, the always-visible
    // Copy-prompt CTA (disabled until there are edits), and the Pick + Close
    // controls. Row 2 is the action bar — edit count, sent-ago indicator, and
    // Reset — which only renders when there's something to act on. The
    // element selector and breadcrumb live below, in the body of the panel,
    // so the top region stays at a consistent height regardless of selection.
    const header = document.createElement('div');
    header.className = 'header';

    const headerTop = document.createElement('div');
    headerTop.className = 'header-row header-row-top';

    const title = document.createElement('div');
    title.className = 'title';
    const titleMain = document.createElement('div');
    titleMain.className = 'title-main';
    const dot = document.createElement('span');
    dot.className = 'dot';
    titleMain.append(dot, document.createTextNode('Repaint'));
    title.appendChild(titleMain);

    this.sentLabel = document.createElement('div');
    this.sentLabel.className = 'title-sent';
    this.sentLabel.style.display = 'none';
    title.appendChild(this.sentLabel);

    this.pickBtn = document.createElement('button');
    this.pickBtn.className = 'pick-btn';
    this.pickBtn.textContent = 'Pick';
    this.pickBtn.title = 'Enter pick mode, then click any element';
    this.pickBtn.addEventListener('click', () => {
      this.setPicking(!this.picking);
      this.handlers.onTogglePick(this.picking);
    });

    this.closeBtn = document.createElement('button');
    this.closeBtn.className = 'close-btn';
    this.closeBtn.title = 'Close panel';
    this.closeBtn.setAttribute('aria-label', 'Close panel');
    this.closeBtn.textContent = '✕';
    this.closeBtn.addEventListener('click', () => this.setOpen(false));

    // Top-level Copy-prompt CTA. The same button used to live inside the
    // (conditionally-rendered) changes section, which made it invisible by
    // default. Promoting it to the header gives the primary action a
    // permanent home and the disabled state communicates "no edits yet" at
    // a glance.
    this.applyBtn = document.createElement('button');
    this.applyBtn.className = 'apply-btn';
    this.applyBtn.textContent = 'Copy prompt';
    this.applyBtn.disabled = true;
    this.applyBtn.title = 'Copy a Claude Code prompt to clipboard';
    this.applyBtn.addEventListener('click', () => this.onApply());

    const headerActions = document.createElement('div');
    headerActions.className = 'header-actions';
    headerActions.append(this.applyBtn, this.pickBtn, this.closeBtn);
    headerTop.append(title, headerActions);
    header.appendChild(headerTop);

    this.targetStrip = document.createElement('div');
    this.targetStrip.className = 'target-strip';

    this.changesEl = document.createElement('div');
    this.changesEl.className = 'changes-section';
    this.changesEl.dataset.open = 'false';
    this.changesEl.style.display = 'none';

    const changesHeader = document.createElement('div');
    changesHeader.className = 'changes-header';

    const changesTitle = document.createElement('button');
    changesTitle.type = 'button';
    changesTitle.className = 'changes-title';
    changesTitle.setAttribute('aria-expanded', 'false');

    const changesChevron = document.createElement('span');
    changesChevron.className = 'changes-chevron';
    changesChevron.innerHTML =
      '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">' +
      '<path d="M2.5 3.5 L5 6 L7.5 3.5" stroke="currentColor" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    const changesDot = document.createElement('span');
    changesDot.className = 'dirty-pill-dot';
    this.changesTitleText = document.createElement('span');
    changesTitle.append(changesChevron, changesDot, this.changesTitleText);

    changesTitle.addEventListener('click', () => {
      const next = this.changesEl.dataset.open !== 'true';
      this.changesEl.dataset.open = String(next);
      changesTitle.setAttribute('aria-expanded', String(next));
    });

    const changesActions = document.createElement('div');
    changesActions.className = 'changes-actions';

    this.resetBtn = document.createElement('button');
    this.resetBtn.className = 'reset-btn';
    this.resetBtn.type = 'button';
    this.resetBtn.textContent = 'Reset';
    this.resetBtn.title = 'Restore all edited elements to their original state';
    this.resetBtn.addEventListener('click', () => this.onReset());

    // Copy-prompt CTA was promoted to the header (always-visible), so the
    // changes section now hosts only Reset alongside the disclosure title.
    changesActions.append(this.resetBtn);
    changesHeader.append(changesTitle, changesActions);
    this.changesList = document.createElement('ul');
    this.changesList.className = 'changes-list';
    this.changesEl.append(changesHeader, this.changesList);

    this.body = document.createElement('div');
    this.body.className = 'body';

    const popoverLayer = document.createElement('div');
    popoverLayer.className = 'popover-layer';

    this.root.append(header, this.changesEl, this.targetStrip, this.body);
    this.shadow.appendChild(popoverLayer);

    this.renderEmpty();
  }

  mount(parent: ParentNode) {
    parent.appendChild(this.host);
    document.body.style.transition = 'margin-right 120ms ease-out';
    this.setOpen(readPersistedOpen());

    window.addEventListener('beforeunload', e => {
      if (this.editedElements().length > 0) {
        e.preventDefault();
        (e as unknown as { returnValue: string }).returnValue = '';
      }
    });

    window.addEventListener(
      'keydown',
      e => {
        if (!(e.metaKey || e.ctrlKey)) return;
        if (e.key !== '.' && e.key !== '\\') return;
        e.preventDefault();
        e.stopPropagation();
        this.setOpen(!this.open);
      },
      { capture: true },
    );
  }

  unmount() {
    this.host.remove();
    document.body.style.marginRight = '';
  }

  setOpen(open: boolean) {
    const wasOpen = this.open;
    this.open = open;
    this.toggleBtn.dataset.open = String(open);
    this.root.style.display = open ? 'flex' : 'none';
    document.body.style.marginRight = open ? PANEL_WIDTH + 'px' : '';
    persistOpen(open);
    if (!open) {
      if (this.picking) {
        this.setPicking(false);
        this.handlers.onTogglePick(false);
      }
      this.handlers.onClearSelection?.();
    } else if (!wasOpen && !this.currentEl && !this.picking) {
      this.setPicking(true);
      this.handlers.onTogglePick(true);
    }
  }

  isOpen() {
    return this.open;
  }

  setPicking(on: boolean) {
    const wasOn = this.picking;
    this.picking = on;
    this.pickBtn.dataset.active = String(on);
    this.pickBtn.textContent = on ? 'Picking…' : 'Pick';
    if (on !== wasOn && !this.currentEl) this.renderEmpty();
  }

  isInPanel(el: Element): boolean {
    return this.host.contains(el) || (el as Node) === this.host;
  }

  renderEmpty() {
    this.currentEl = null;
    this.refreshChanges();
    this.targetStrip.innerHTML = '';
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = 'No selection';
    this.targetStrip.appendChild(hint);

    this.body.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML = this.picking
      ? `<strong>Pick mode</strong>Click any element on the page. Press <em>Esc</em> to stop.`
      : `<strong>No element selected</strong>Click <em>Pick</em> then click any element in the page to start.`;
    this.body.appendChild(empty);
  }

  private async onApply() {
    const editedElements = this.editedElements();
    if (editedElements.length === 0) return;
    const prompt = this.buildPrompt();
    this.applyBtn.disabled = true;
    this.applyBtn.textContent = 'Copying…';

    const [copied, server] = await Promise.all([copyToClipboard(prompt), postApply(prompt)]);

    let label = 'Copied + saved ✓';
    let cls = 'apply-btn-ok';
    let success = true;
    if (copied && server.ok) label = 'Copied + saved ✓';
    else if (copied) label = 'Copied to clipboard';
    else if (server.ok) label = 'Saved';
    else {
      label = 'Failed';
      cls = 'apply-btn-err';
      success = false;
    }

    this.applyBtn.textContent = label;
    this.applyBtn.classList.add(cls);

    if (success) {
      this.lastSentAt = Date.now();
      this.refreshSentLabel();
      this.startSentLabelTicker();
    }
    setTimeout(() => {
      this.applyBtn.textContent = 'Copy prompt';
      this.applyBtn.classList.remove('apply-btn-ok', 'apply-btn-err');
      this.applyBtn.disabled = this.editedElements().length === 0;
    }, 1800);
  }

  private refreshSentLabel() {
    if (this.lastSentAt == null) {
      this.sentLabel.style.display = 'none';
      return;
    }
    this.sentLabel.style.display = '';
    this.sentLabel.textContent = `Sent ${formatTimeAgo(Date.now() - this.lastSentAt)}`;
  }

  private startSentLabelTicker() {
    if (this.sentLabelTimer != null) return;
    const tick = () => {
      this.refreshSentLabel();
      const ago = this.lastSentAt == null ? 0 : Date.now() - this.lastSentAt;
      this.sentLabelTimer = window.setTimeout(tick, ago < 60_000 ? 5_000 : 30_000);
    };
    this.sentLabelTimer = window.setTimeout(tick, 5_000);
  }

  private onReset() {
    if (this.snapshots.size === 0) return;
    for (const [el, snap] of this.snapshots) restoreSnapshot(el, snap);
    this.snapshots.clear();
    if (this.currentEl) this.renderSelected(this.currentEl);
    else this.refreshChanges();
    this.handlers.onMutated?.();
  }

  private editedElements(): { el: Element; snapshot: Snapshot }[] {
    const out: { el: Element; snapshot: Snapshot }[] = [];
    for (const [el, snap] of this.snapshots) {
      if (computeChanges(snap, el).length > 0) out.push({ el, snapshot: snap });
    }
    return out;
  }

  private buildPrompt(): string {
    const elements = Array.from(this.snapshots.entries()).map(([el, snapshot]) => ({
      el,
      snapshot,
      classChanges: getClassChanges(el),
    }));
    return buildSessionPrompt(elements);
  }

  renderSelected(el: Element): void {
    this.currentEl = el;
    this.body.innerHTML = '';

    if (!this.snapshots.has(el)) this.snapshots.set(el, takeSnapshot(el));

    this.refreshTargetStrip();
    this.refreshChanges();

    // 1. Classes
    this.body.appendChild(createClassSection(el, () => this.handlers.onMutated?.()));

    // 2. Layout
    for (const s of createLayoutSections(el, () => this.handlers.onMutated?.())) {
      this.body.appendChild(s);
    }

    // 3. Visual (token-aware via scanned CSS vars)
    for (const s of createVisualSections(el, () => this.handlers.onMutated?.(), this.tokens)) {
      this.body.appendChild(s);
    }

    // 4. Typography
    this.body.appendChild(buildTypographySection(el, () => this.handlers.onMutated?.()));
  }

  private refreshTargetStrip() {
    if (!this.currentEl) return;
    this.targetStrip.innerHTML = '';
    const breadcrumb = ancestorBreadcrumb(
      this.currentEl,
      el => this.handlers.onSelectElement?.(el),
      el => this.handlers.onPreviewElement?.(el),
    );
    if (breadcrumb) this.targetStrip.appendChild(breadcrumb);
    this.targetStrip.appendChild(selectorLine(this.currentEl));
    const descendants = descendantList(
      this.currentEl,
      el => this.handlers.onSelectElement?.(el),
      el => this.handlers.onPreviewElement?.(el),
    );
    if (descendants) this.targetStrip.appendChild(descendants);
  }

  private refreshChanges() {
    const groups: { el: Element; changes: Change[] }[] = [];
    let totalChanges = 0;
    for (const [el, snap] of this.snapshots) {
      const changes = computeChanges(snap, el);
      if (changes.length === 0) continue;
      groups.push({ el, changes });
      totalChanges += changes.length;
    }

    if (groups.length === 0) {
      this.changesEl.style.display = 'none';
      this.changesList.innerHTML = '';
      this.applyBtn.disabled = true;
      return;
    }

    this.changesEl.style.display = '';
    this.applyBtn.disabled = false;
    this.changesTitleText.textContent = `Local edits (${totalChanges})`;
    this.changesList.innerHTML = '';
    for (const group of groups) {
      this.changesList.appendChild(renderChangeGroup(group.el, group.changes, ch => this.revertChange(group.el, ch)));
    }
  }

  private revertChange(el: Element, ch: Change) {
    const html = el as HTMLElement;
    switch (ch.kind) {
      case 'class-add':
        html.classList.remove(ch.value);
        break;
      case 'class-remove':
        html.classList.add(ch.value);
        break;
      case 'style-add':
        html.style.removeProperty(ch.prop);
        break;
      case 'style-remove':
        html.style.setProperty(ch.prop, ch.value);
        break;
      case 'style-change':
        html.style.setProperty(ch.prop, ch.from);
        break;
      case 'value':
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.value = ch.from;
        break;
      case 'placeholder':
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.placeholder = ch.from;
        break;
      case 'text':
        return;
      case 'attr':
        if (ch.from) html.setAttribute(ch.attr, '');
        else html.removeAttribute(ch.attr);
        break;
      case 'icon':
        // icon changes are not supported in the generic panel
        break;
      case 'variant':
        // variant changes are not supported in the generic panel
        break;
    }
    this.refreshChanges();
    if (this.currentEl === el) this.renderSelected(el);
    this.handlers.onMutated?.();
  }
}

// ─── Change list rendering ────────────────────────────────────────────────────

function renderChange(ch: Change, onRevert: () => void): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'change';

  const icon = document.createElement('span');
  icon.className = 'change-icon';

  const text = document.createElement('span');
  text.className = 'change-text';

  switch (ch.kind) {
    case 'class-add':
      icon.classList.add('change-icon-add');
      icon.textContent = '+';
      text.innerHTML = `class <code>.${escapeHtml(ch.value)}</code>`;
      break;
    case 'class-remove':
      icon.classList.add('change-icon-remove');
      icon.textContent = '−';
      text.innerHTML = `class <code>.${escapeHtml(ch.value)}</code>`;
      break;
    case 'style-add':
      icon.classList.add('change-icon-add');
      icon.textContent = '+';
      text.innerHTML = `<code>${escapeHtml(ch.prop)}</code>: <code>${escapeHtml(ch.value)}</code>`;
      break;
    case 'style-remove':
      icon.classList.add('change-icon-remove');
      icon.textContent = '−';
      text.innerHTML = `<code>${escapeHtml(ch.prop)}</code>: <code>${escapeHtml(ch.value)}</code>`;
      break;
    case 'style-change':
      icon.classList.add('change-icon-mod');
      icon.textContent = '~';
      text.innerHTML = `<code>${escapeHtml(ch.prop)}</code>: <code>${escapeHtml(ch.from)}</code> → <code>${escapeHtml(ch.to)}</code>`;
      break;
    case 'text':
      icon.classList.add('change-icon-mod');
      icon.textContent = '✎';
      text.innerHTML = `text: <code>"${escapeHtml(truncate(ch.from, 24))}"</code> → <code>"${escapeHtml(truncate(ch.to, 24))}"</code>`;
      break;
    case 'value':
      icon.classList.add('change-icon-mod');
      icon.textContent = '✎';
      text.innerHTML = `value: <code>"${escapeHtml(truncate(ch.from, 24))}"</code> → <code>"${escapeHtml(truncate(ch.to, 24))}"</code>`;
      break;
    case 'placeholder':
      icon.classList.add('change-icon-mod');
      icon.textContent = '✎';
      text.innerHTML = `placeholder: <code>"${escapeHtml(truncate(ch.from, 24))}"</code> → <code>"${escapeHtml(truncate(ch.to, 24))}"</code>`;
      break;
    case 'attr':
      icon.classList.add(ch.to ? 'change-icon-add' : 'change-icon-remove');
      icon.textContent = ch.to ? '+' : '−';
      text.innerHTML = `attribute <code>${escapeHtml(ch.attr)}</code>`;
      break;
    case 'icon':
      if (ch.to) {
        icon.classList.add(ch.from ? 'change-icon-mod' : 'change-icon-add');
        icon.textContent = ch.from ? '~' : '+';
        text.innerHTML = `icon: <code>${escapeHtml(ch.to)}</code>`;
      } else {
        icon.classList.add('change-icon-remove');
        icon.textContent = '−';
        text.textContent = 'icon removed';
      }
      break;
    case 'variant':
      icon.classList.add('change-icon-mod');
      icon.textContent = '~';
      text.innerHTML = `variant <code>${escapeHtml(ch.name)}</code>: <code>${escapeHtml(ch.from)}</code> → <code>${escapeHtml(ch.to)}</code>`;
      break;
  }

  li.append(icon, text);

  if (ch.kind !== 'text') {
    const revert = document.createElement('button');
    revert.type = 'button';
    revert.className = 'change-revert';
    revert.title = 'Revert this change';
    revert.setAttribute('aria-label', 'Revert this change');
    revert.textContent = '✕';
    revert.addEventListener('click', e => {
      e.stopPropagation();
      onRevert();
    });
    li.appendChild(revert);
  }

  return li;
}

function renderChangeGroup(el: Element, changes: Change[], onRevert: (ch: Change) => void): HTMLLIElement {
  const wrap = document.createElement('li');
  wrap.className = 'change-group';

  const head = document.createElement('div');
  head.className = 'change-group-head';
  head.appendChild(shortSelectorLine(el));
  wrap.appendChild(head);

  const list = document.createElement('ul');
  list.className = 'change-group-items';
  for (const ch of changes) list.appendChild(renderChange(ch, () => onRevert(ch)));
  wrap.appendChild(list);

  return wrap;
}

function shortSelectorLine(el: Element): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.className = 'selector-line';
  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = el.tagName.toLowerCase();
  wrap.appendChild(tag);
  if (el.id) {
    const id = document.createElement('span');
    id.className = 'id';
    id.textContent = '#' + el.id;
    wrap.appendChild(id);
  }
  for (const c of (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2)) {
    const span = document.createElement('span');
    span.className = 'cls';
    span.textContent = '.' + c;
    wrap.appendChild(span);
  }
  return wrap;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

function formatTimeAgo(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

// ─── Target strip helpers ─────────────────────────────────────────────────────

function ancestorBreadcrumb(el: Element, onSelect: (el: Element) => void, onPreview?: (el: Element | null) => void): HTMLDivElement | null {
  const ancestors: Element[] = [];
  let cur = el.parentElement;
  while (cur && cur !== document.body && ancestors.length < 4) {
    if (cur.getAttribute('data-repaint') !== 'true') ancestors.push(cur);
    cur = cur.parentElement;
  }
  if (ancestors.length === 0) return null;
  ancestors.reverse();

  const wrap = document.createElement('div');
  wrap.className = 'breadcrumb';
  ancestors.forEach((a, i) => {
    const seg = document.createElement('button');
    seg.type = 'button';
    seg.className = 'breadcrumb-seg';
    seg.title = `Select ${describeShort(a)}`;
    seg.textContent = describeShort(a);
    seg.addEventListener('click', e => {
      e.stopPropagation();
      onSelect(a);
    });
    if (onPreview) {
      seg.addEventListener('mouseenter', () => onPreview(a));
      seg.addEventListener('mouseleave', () => onPreview(null));
    }
    wrap.appendChild(seg);
    if (i < ancestors.length - 1) {
      const sep = document.createElement('span');
      sep.className = 'breadcrumb-sep';
      sep.textContent = '›';
      wrap.appendChild(sep);
    }
  });
  return wrap;
}

function selectorLine(el: Element): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.className = 'selector-line-wrap';

  // Main row: badge (element name) + "Show classes" toggle side by side
  const mainRow = document.createElement('div');
  mainRow.className = 'selector-main-row';

  const badge = document.createElement('span');
  badge.className = 'selector-badge';
  const diamond = document.createElement('span');
  diamond.className = 'selector-badge-diamond';
  diamond.textContent = '◆';
  const tagName = el.tagName.toLowerCase();
  const nameNode = document.createTextNode(tagName.charAt(0).toUpperCase() + tagName.slice(1));
  badge.appendChild(diamond);
  badge.appendChild(nameNode);
  if (el.id) {
    const idSpan = document.createElement('span');
    idSpan.className = 'selector-badge-id';
    idSpan.textContent = '#' + el.id;
    badge.appendChild(idSpan);
  }
  mainRow.appendChild(badge);

  // Class list — hidden until toggled
  const inner = document.createElement('div');
  inner.className = 'selector-line';
  inner.dataset.expanded = 'false';

  const classes = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean);
  for (const c of classes) inner.appendChild(buildClassSpan(c, 'rest'));

  if (classes.length > 0) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'selector-line-toggle';
    const setLabel = (expanded: boolean) => {
      toggle.textContent = expanded ? 'Hide classes' : 'Show classes';
    };
    setLabel(false);
    toggle.addEventListener('click', () => {
      const next = inner.dataset.expanded !== 'true';
      inner.dataset.expanded = String(next);
      setLabel(next);
    });
    mainRow.appendChild(toggle);
  }

  wrap.appendChild(mainRow);
  wrap.appendChild(inner);
  return wrap;
}

function buildClassSpan(c: string, kind: 'primary' | 'rest'): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'cls';
  span.dataset.kind = kind;
  span.textContent = '.' + c;
  return span;
}

/**
 * Inverse of the ancestor breadcrumb — direct children of the currently
 * selected element, each clickable to dive into. Lets designers drill
 * down through the DOM tree from the panel without re-entering pick mode.
 *
 * Caps at VISIBLE_DESCENDANTS chips by default to keep large lists/grids
 * from dominating the strip. A `Show N more` / `Show less` toggle reveals
 * the rest in-place. Repaint's own host element (data-repaint="true") is
 * excluded so the panel never lists itself.
 */
const VISIBLE_DESCENDANTS = 3;
function descendantList(el: Element, onSelect: (el: Element) => void, onPreview?: (el: Element | null) => void): HTMLDivElement | null {
  const children: Element[] = [];
  for (const child of Array.from(el.children)) {
    if (child.getAttribute('data-repaint') === 'true') continue;
    children.push(child);
  }
  if (children.length === 0) return null;

  const wrap = document.createElement('div');
  wrap.className = 'breadcrumb';
  wrap.setAttribute('data-direction', 'down');
  wrap.dataset.expanded = 'false';

  const arrow = document.createElement('span');
  arrow.className = 'breadcrumb-sep';
  arrow.textContent = '↳';
  arrow.title = 'Dive into a child';
  wrap.appendChild(arrow);

  const makeSeg = (c: Element): HTMLButtonElement => {
    const seg = document.createElement('button');
    seg.type = 'button';
    seg.className = 'breadcrumb-seg';
    seg.title = `Select ${describeShort(c)}`;
    seg.textContent = describeShort(c);
    seg.addEventListener('click', e => {
      e.stopPropagation();
      onSelect(c);
    });
    if (onPreview) {
      seg.addEventListener('mouseenter', () => onPreview(c));
      seg.addEventListener('mouseleave', () => onPreview(null));
    }
    return seg;
  };
  const makeSep = (): HTMLSpanElement => {
    const sep = document.createElement('span');
    sep.className = 'breadcrumb-sep';
    sep.textContent = '·';
    return sep;
  };

  // Render every chip up front and mark anything past the visible window as
  // overflow; CSS hides overflow chips/separators while data-expanded="false".
  // This avoids the DOM-insertion dance of "build the rest lazily" — the
  // toggle just flips one attribute.
  children.forEach((c, i) => {
    const seg = makeSeg(c);
    if (i >= VISIBLE_DESCENDANTS) seg.dataset.overflow = 'true';
    wrap.appendChild(seg);
    if (i < children.length - 1) {
      const sep = makeSep();
      // Separator preceding an overflow chip also hides until expanded.
      if (i + 1 >= VISIBLE_DESCENDANTS) sep.dataset.overflow = 'true';
      wrap.appendChild(sep);
    }
  });

  if (children.length > VISIBLE_DESCENDANTS) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'breadcrumb-more';
    const updateLabel = () => {
      toggle.textContent = wrap.dataset.expanded === 'true' ? 'Show less' : `Show ${children.length - VISIBLE_DESCENDANTS} more`;
    };
    updateLabel();
    toggle.addEventListener('click', e => {
      e.stopPropagation();
      wrap.dataset.expanded = wrap.dataset.expanded === 'true' ? 'false' : 'true';
      updateLabel();
    });
    wrap.appendChild(toggle);
  }

  return wrap;
}

function describeShort(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `${tag}#${el.id}`;
  const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean)[0];
  return cls ? `${tag}.${cls}` : tag;
}

// ─── Persistence helpers ──────────────────────────────────────────────────────

const STORAGE_KEY_OPEN = 'repaint-panel-open';

function readPersistedOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_OPEN) === 'true';
  } catch {
    return false;
  }
}

function persistOpen(open: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY_OPEN, String(open));
  } catch {
    /* private mode */
  }
}
