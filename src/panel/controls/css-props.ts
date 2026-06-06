import { SHADOW_PRESETS, SPACING_SCALE, RADIUS_SCALE, findStop, matchShadow, type ShadowPreset, type SpacingStop } from '../design-tokens';
import type { ScannedToken } from '../css-var-scanner';

import { createColorChip } from './color-picker';
import { createSection } from './section';
import { highlightSpacing, clearSpacingHighlight, type SpacingKind, type SpacingSide } from './spacing-hover';

const ICON_FLEX_ROW =
  '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1"><rect x="2" y="4" width="3" height="6" rx="0.5"/><rect x="6" y="4" width="3" height="6" rx="0.5"/><rect x="10" y="4" width="2" height="6" rx="0.5" opacity="0.5"/></svg>';
const ICON_FLEX_COL =
  '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1"><rect x="4" y="2" width="6" height="3" rx="0.5"/><rect x="4" y="6" width="6" height="3" rx="0.5"/><rect x="4" y="10" width="6" height="2" rx="0.5" opacity="0.5"/></svg>';
const ICON_JUSTIFY_START =
  '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="1" y="2" width="1" height="10" opacity="0.4"/><rect x="3" y="4" width="3" height="6" rx="0.5"/><rect x="7" y="4" width="3" height="6" rx="0.5"/></svg>';
const ICON_JUSTIFY_CENTER =
  '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="7" y="2" width="0.5" height="10" opacity="0.4"/><rect x="2" y="4" width="3" height="6" rx="0.5"/><rect x="9" y="4" width="3" height="6" rx="0.5"/></svg>';
const ICON_JUSTIFY_END =
  '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="12" y="2" width="1" height="10" opacity="0.4"/><rect x="4" y="4" width="3" height="6" rx="0.5"/><rect x="8" y="4" width="3" height="6" rx="0.5"/></svg>';
const ICON_JUSTIFY_BETWEEN =
  '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="1" y="4" width="3" height="6" rx="0.5"/><rect x="10" y="4" width="3" height="6" rx="0.5"/></svg>';
const ICON_JUSTIFY_AROUND =
  '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="4" width="3" height="6" rx="0.5"/><rect x="9" y="4" width="3" height="6" rx="0.5"/></svg>';
const ICON_ALIGN_START =
  '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="1" width="10" height="1" opacity="0.4"/><rect x="3" y="3" width="3" height="6" rx="0.5"/><rect x="8" y="3" width="3" height="4" rx="0.5"/></svg>';
const ICON_ALIGN_CENTER =
  '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="7" width="10" height="0.5" opacity="0.4"/><rect x="3" y="4" width="3" height="6" rx="0.5"/><rect x="8" y="5" width="3" height="4" rx="0.5"/></svg>';
const ICON_ALIGN_END =
  '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="12" width="10" height="1" opacity="0.4"/><rect x="3" y="5" width="3" height="6" rx="0.5"/><rect x="8" y="7" width="3" height="4" rx="0.5"/></svg>';
const ICON_ALIGN_STRETCH =
  '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="3" y="2" width="3" height="10" rx="0.5"/><rect x="8" y="2" width="3" height="10" rx="0.5"/></svg>';
const ICON_OVERFLOW_VISIBLE =
  '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1"><rect x="2.5" y="2.5" width="9" height="9" rx="1"/><circle cx="7" cy="7" r="1" fill="currentColor" stroke="none"/></svg>';
const ICON_OVERFLOW_HIDDEN =
  '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1"><rect x="2.5" y="2.5" width="9" height="9" rx="1" fill="currentColor" opacity="0.15"/><rect x="2.5" y="2.5" width="9" height="9" rx="1"/></svg>';
// One outer wrap that hosts a stack of top-level Figma-style sections. This
// mirrors Figma's right-rail ordering exactly: Auto layout → Sizing →
// Appearance → Fill → Stroke → Effects → Typography. Each block becomes its
// own collapsible .fsection so the section header reads as full-weight, the
// border lines stack vertically as designers expect, and individual sections
// can be hidden until they apply (Auto layout only when the element is a
// flex container).
/**
 * Layout sections — Auto layout (flex only) + Sizing + Spacing. Safe for both
 * cxui design-system components and primitives; the cxui lock-down only hides
 * the visual sections (Appearance / Fill / Stroke / Effects).
 */
export function createLayoutSections(el: Element, onChange: () => void): HTMLDivElement[] {
  const out: HTMLDivElement[] = [];
  const autoLayout = buildAutoLayoutSection(el, onChange);
  if (autoLayout) out.push(autoLayout);
  out.push(buildSizingSection(el, onChange));
  out.push(buildSpacingSection(el, onChange));
  return out;
}

/**
 * Visual sections — Appearance (opacity + radius), Fill, Stroke, Effects.
 * Primitives only. cxui components hide all four to keep DS visuals locked.
 */
export function createVisualSections(el: Element, onChange: () => void, tokens: ScannedToken[] = []): HTMLDivElement[] {
  return [
    buildAppearanceSection(el, onChange),
    buildFillSection(el, onChange, tokens),
    buildStrokeSection(el, onChange, tokens),
    buildEffectsSection(el, onChange),
  ];
}

/**
 * @deprecated Compose `createLayoutSections` + `createVisualSections` +
 *   `buildPrimitiveTypographySection` directly. The monolithic builder lives
 *   on only so existing call sites compile until Task 10 rewires the panel.
 */
export function createCssPropsSection(el: Element, onChange: () => void, tokens: ScannedToken[] = []): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.className = 'css-props-wrap';
  for (const s of [...createLayoutSections(el, onChange), ...createVisualSections(el, onChange, tokens)]) {
    wrap.appendChild(s);
  }
  return wrap;
}

function cs(el: Element): CSSStyleDeclaration {
  return window.getComputedStyle(el);
}

function currentPx(el: Element, prop: keyof CSSStyleDeclaration): number {
  return parseFloat((cs(el)[prop] as string) ?? '0') || 0;
}

function isFlexContainer(el: Element): boolean {
  const display = window.getComputedStyle(el).display;
  return display === 'flex' || display === 'inline-flex';
}

// ─── Auto layout (flex containers only) ───────────────────────────────────────

function buildAutoLayoutSection(el: Element, onChange: () => void): HTMLDivElement | null {
  if (!isFlexContainer(el)) return null;

  const { root, body } = createSection({ title: 'Auto layout', defaultOpen: true });
  const wrap = body;
  const html = el as HTMLElement;

  const direction = cs(el).flexDirection || 'row';
  wrap.appendChild(
    makeIconRow(
      '',
      [
        { value: 'row', label: 'Row', icon: ICON_FLEX_ROW },
        { value: 'column', label: 'Column', icon: ICON_FLEX_COL },
      ],
      direction.startsWith('column') ? 'column' : 'row',
      val => {
        html.style.flexDirection = val;
        onChange();
      },
    ),
  );

  const justify = cs(el).justifyContent || 'flex-start';
  wrap.appendChild(
    makeIconRow(
      '',
      [
        { value: 'flex-start', label: 'Start', icon: ICON_JUSTIFY_START },
        { value: 'center', label: 'Center', icon: ICON_JUSTIFY_CENTER },
        { value: 'flex-end', label: 'End', icon: ICON_JUSTIFY_END },
        { value: 'space-between', label: 'Between', icon: ICON_JUSTIFY_BETWEEN },
        { value: 'space-around', label: 'Around', icon: ICON_JUSTIFY_AROUND },
      ],
      normalizeJustify(justify),
      val => {
        html.style.justifyContent = val;
        onChange();
      },
    ),
  );

  const align = cs(el).alignItems || 'stretch';
  wrap.appendChild(
    makeIconRow(
      '',
      [
        { value: 'flex-start', label: 'Start', icon: ICON_ALIGN_START },
        { value: 'center', label: 'Center', icon: ICON_ALIGN_CENTER },
        { value: 'flex-end', label: 'End', icon: ICON_ALIGN_END },
        { value: 'stretch', label: 'Stretch', icon: ICON_ALIGN_STRETCH },
      ],
      normalizeAlign(align),
      val => {
        html.style.alignItems = val;
        onChange();
      },
    ),
  );

  const gap = parseFloat(cs(el).gap) || 0;
  wrap.appendChild(
    makeTokenAwarePxInput('Gap', gap, SPACING_SCALE, val => {
      html.style.gap = val === null ? '' : `${val}px`;
      onChange();
    }),
  );

  const overflow = cs(el).overflow || 'visible';
  wrap.appendChild(
    makeIconRow(
      '',
      [
        { value: 'visible', label: 'Visible', icon: ICON_OVERFLOW_VISIBLE },
        { value: 'hidden', label: 'Clip', icon: ICON_OVERFLOW_HIDDEN },
      ],
      overflow === 'hidden' ? 'hidden' : 'visible',
      val => {
        html.style.overflow = val;
        onChange();
      },
    ),
  );

  return root;
}

function normalizeJustify(v: string): string {
  if (v === 'start' || v === 'left') return 'flex-start';
  if (v === 'end' || v === 'right') return 'flex-end';
  return v;
}

function normalizeAlign(v: string): string {
  if (v === 'start') return 'flex-start';
  if (v === 'end') return 'flex-end';
  return v;
}

// ─── Sizing ───────────────────────────────────────────────────────────────────

function readSize(el: Element, axis: 'width' | 'height'): { value: number; unit: SizeUnit } {
  const inline = (el as HTMLElement).style[axis];
  if (inline === 'auto') return { value: 0, unit: 'auto' };
  const m = inline?.match(/^(-?\d+(?:\.\d+)?)(px|%)$/);
  if (m) return { value: parseFloat(m[1]), unit: m[2] as SizeUnit };
  const computed = parseFloat(window.getComputedStyle(el)[axis]) || 0;
  return { value: Math.round(computed), unit: 'px' };
}

function buildSizingSection(el: Element, onChange: () => void): HTMLDivElement {
  const { root, body } = createSection({ title: 'Sizing', defaultOpen: true });

  for (const axis of ['width', 'height'] as const) {
    const initial = readSize(el, axis);
    body.appendChild(
      makeUnitInput(axis === 'width' ? 'W' : 'H', initial, ['px', '%', 'auto'], ({ value, unit }) => {
        const html = el as HTMLElement;
        if (unit === 'auto') html.style[axis] = 'auto';
        else if (unit === '%') html.style[axis] = `${value}%`;
        else html.style[axis] = `${value}px`;
        onChange();
      }),
    );
  }

  return root;
}

// ─── Spacing ──────────────────────────────────────────────────────────────────

// Figma-style padding control. Two display modes:
//   - Combined (default): one input for horizontal (left + right), one for
//     vertical (top + bottom). Each cell carries a small side-icon hinting
//     at which physical sides the value drives.
//   - Individual: 2×2 grid of T/R/B/L inputs, each with its own side-icon.
// A mode-toggle on the right swaps between the two. Clicking any cell opens
// the spacing-token picker — same token-aware behaviour as the rest of the
// panel, just framed as a single inline cell instead of a row + chip pair.

function buildSpacingSection(el: Element, onChange: () => void): HTMLDivElement {
  const { root, body } = createSection({ title: 'Spacing', defaultOpen: true });

  const padLabel = document.createElement('div');
  padLabel.className = 'variant-axis-header';
  padLabel.textContent = 'Padding';
  body.appendChild(padLabel);
  body.appendChild(buildFigmaPad(el, 'padding', ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'], onChange));

  const marginLabel = document.createElement('div');
  marginLabel.className = 'variant-axis-header';
  marginLabel.style.marginTop = '8px';
  marginLabel.textContent = 'Margin';
  body.appendChild(marginLabel);
  body.appendChild(buildFigmaPad(el, 'margin', ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'], onChange));

  return root;
}

// Sides are top, right, bottom, left in this exact order — matches the order
// of the four CSS properties passed to buildFigmaPad.
type Side = 'top' | 'right' | 'bottom' | 'left';
const SIDE_LABEL: Record<Side, string> = {
  top: 'Top',
  right: 'Right',
  bottom: 'Bottom',
  left: 'Left',
};

// Side-icons: a small element-box plus a bar indicating which side(s) the
// input drives. Same visual idiom as Figma — designer reads the icon, not
// the label, so cells stay narrow.
const ICON_PAD_H =
  '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"><path d="M2 3.5v7"/><path d="M12 3.5v7"/><rect x="5" y="5" width="4" height="4" rx="0.5" fill="currentColor" stroke="none"/></svg>';
const ICON_PAD_V =
  '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"><path d="M3.5 2h7"/><path d="M3.5 12h7"/><rect x="5" y="5" width="4" height="4" rx="0.5" fill="currentColor" stroke="none"/></svg>';
const ICON_PAD_T =
  '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"><path d="M3.5 2h7"/><rect x="5" y="5" width="4" height="4" rx="0.5" fill="currentColor" stroke="none"/></svg>';
const ICON_PAD_R =
  '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"><path d="M12 3.5v7"/><rect x="5" y="5" width="4" height="4" rx="0.5" fill="currentColor" stroke="none"/></svg>';
const ICON_PAD_B =
  '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"><path d="M3.5 12h7"/><rect x="5" y="5" width="4" height="4" rx="0.5" fill="currentColor" stroke="none"/></svg>';
const ICON_PAD_L =
  '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"><path d="M2 3.5v7"/><rect x="5" y="5" width="4" height="4" rx="0.5" fill="currentColor" stroke="none"/></svg>';
// Mode toggle — four corner brackets, the same idiom Figma uses for "show
// individual sides". Filled when individual mode is active.
const ICON_PAD_MODE =
  '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"><path d="M2 4V2h2"/><path d="M10 2h2v2"/><path d="M12 10v2h-2"/><path d="M4 12H2v-2"/></svg>';

function buildFigmaPad(el: Element, kind: SpacingKind, props: [string, string, string, string], onChange: () => void): HTMLDivElement {
  // Start in individual mode only when the four sides actually differ. If
  // they're equal pairwise, combined mode is enough.
  let mode: 'combined' | 'individual' = sidesPairwiseEqual(el, props) ? 'combined' : 'individual';

  const root = document.createElement('div');
  root.className = 'figma-pad';
  root.dataset.mode = mode;

  const grid = document.createElement('div');
  grid.className = 'figma-pad-grid';
  root.appendChild(grid);

  // Mode toggle button — anchored to the right of the grid in both modes.
  const modeBtn = document.createElement('button');
  modeBtn.type = 'button';
  modeBtn.className = 'figma-pad-mode';
  modeBtn.innerHTML = ICON_PAD_MODE;
  modeBtn.title = 'Toggle individual / combined padding';
  modeBtn.dataset.on = String(mode === 'individual');
  modeBtn.addEventListener('click', () => {
    mode = mode === 'combined' ? 'individual' : 'combined';
    root.dataset.mode = mode;
    modeBtn.dataset.on = String(mode === 'individual');
    renderGrid();
  });
  root.appendChild(modeBtn);

  const setSide = (side: Side, val: number | null) => {
    const html = el as HTMLElement;
    const idx = (['top', 'right', 'bottom', 'left'] as const).indexOf(side);
    const p = props[idx] as keyof CSSStyleDeclaration;
    html.style[p as never] = val === null ? '' : `${val}px`;
    onChange();
  };

  const renderGrid = () => {
    grid.innerHTML = '';
    if (mode === 'combined') {
      // Horizontal: average of left+right; setting it writes both.
      const left = currentPx(el, props[3] as keyof CSSStyleDeclaration);
      const right = currentPx(el, props[1] as keyof CSSStyleDeclaration);
      const top = currentPx(el, props[0] as keyof CSSStyleDeclaration);
      const bottom = currentPx(el, props[2] as keyof CSSStyleDeclaration);
      // When the pair already disagrees we show "Mixed" until the user picks.
      const hValue = left === right ? left : null;
      const vValue = top === bottom ? top : null;
      grid.appendChild(
        makePadCell({
          icon: ICON_PAD_H,
          title: `Horizontal ${kind} (left + right)`,
          value: hValue,
          el,
          kind,
          highlightSides: ['left', 'right'],
          onPick: v => {
            setSide('left', v);
            setSide('right', v);
            renderGrid();
          },
        }),
      );
      grid.appendChild(
        makePadCell({
          icon: ICON_PAD_V,
          title: `Vertical ${kind} (top + bottom)`,
          value: vValue,
          el,
          kind,
          highlightSides: ['top', 'bottom'],
          onPick: v => {
            setSide('top', v);
            setSide('bottom', v);
            renderGrid();
          },
        }),
      );
    } else {
      // Individual — 2×2 grid order: T, R, B, L (matches what designers read
      // first across, then down — same as the inputs in Figma's panel).
      const order: Array<[Side, string]> = [
        ['top', ICON_PAD_T],
        ['right', ICON_PAD_R],
        ['bottom', ICON_PAD_B],
        ['left', ICON_PAD_L],
      ];
      for (const [side, icon] of order) {
        const idx = (['top', 'right', 'bottom', 'left'] as const).indexOf(side);
        const value = currentPx(el, props[idx] as keyof CSSStyleDeclaration);
        grid.appendChild(
          makePadCell({
            icon,
            title: `${SIDE_LABEL[side]} ${kind}`,
            value,
            el,
            kind,
            highlightSides: [side],
            onPick: v => {
              setSide(side, v);
              renderGrid();
            },
          }),
        );
      }
    }
  };

  renderGrid();
  return root;
}

interface PadCellProps {
  icon: string;
  title: string;
  value: number | null;
  el: Element;
  kind: SpacingKind;
  highlightSides: SpacingSide[];
  onPick: (val: number | null) => void;
}

// One padding input. Click opens the spacing token picker; the displayed
// number is the raw px. "Mixed" surfaces when the user is in combined mode
// but the pair disagrees — picking from the popover writes both sides and
// resolves the mixed state on the next render.
//
// Hover paints a magenta diagonal-stripe band over the actual physical
// region(s) on the picked element so the designer sees which spacing the
// input drives without reading the label.
function makePadCell(props: PadCellProps): HTMLButtonElement {
  const cell = document.createElement('button');
  cell.type = 'button';
  cell.className = 'figma-pad-cell';
  cell.title = props.title;

  const icon = document.createElement('span');
  icon.className = 'figma-pad-icon';
  icon.innerHTML = props.icon;

  const value = document.createElement('span');
  value.className = 'figma-pad-value';

  const display = (v: number | null) => {
    if (v === null) {
      value.textContent = 'Mixed';
      cell.dataset.scale = 'match';
      return;
    }
    value.textContent = String(Math.round(v));
    const stop = findStop(v, SPACING_SCALE);
    cell.dataset.scale = stop || v === 0 ? 'match' : 'off';
  };
  display(props.value);

  cell.append(icon, value);
  cell.addEventListener('click', () => {
    openTokenPicker(cell, SPACING_SCALE, stop => {
      props.onPick(stop.value);
      display(stop.value);
    });
  });
  // Hover overlay: matches Figma's behaviour — pointing at the input lights
  // up the actual spacing region on the canvas so it's unambiguous which
  // side(s) you're about to change.
  cell.addEventListener('mouseenter', () => highlightSpacing(props.el, props.kind, props.highlightSides));
  cell.addEventListener('mouseleave', () => clearSpacingHighlight());
  cell.addEventListener('focus', () => highlightSpacing(props.el, props.kind, props.highlightSides));
  cell.addEventListener('blur', () => clearSpacingHighlight());
  return cell;
}

function sidesPairwiseEqual(el: Element, props: [string, string, string, string]): boolean {
  const top = currentPx(el, props[0] as keyof CSSStyleDeclaration);
  const right = currentPx(el, props[1] as keyof CSSStyleDeclaration);
  const bottom = currentPx(el, props[2] as keyof CSSStyleDeclaration);
  const left = currentPx(el, props[3] as keyof CSSStyleDeclaration);
  return top === bottom && left === right;
}

// ─── Appearance ───────────────────────────────────────────────────────────────

// ─── Appearance — opacity + corner radius (Figma's "Appearance" section) ─────

function buildAppearanceSection(el: Element, onChange: () => void): HTMLDivElement {
  const { root, body } = createSection({ title: 'Appearance', defaultOpen: true });
  const html = el as HTMLElement;

  const opacityRaw = parseFloat(cs(el).opacity);
  const opacity = Math.round((Number.isNaN(opacityRaw) ? 1 : opacityRaw) * 100);
  body.appendChild(
    makeRangeInput('Opacity', opacity, 0, 100, '%', val => {
      html.style.opacity = val === null ? '' : String(val / 100);
      onChange();
    }),
  );

  const radius = parseFloat(cs(el).borderRadius) || 0;
  body.appendChild(
    makeTokenAwarePxInput('Radius', radius, RADIUS_SCALE, val => {
      html.style.borderRadius = val === null ? '' : `${val}px`;
      onChange();
    }),
  );

  return root;
}

// ─── Fill — background colour (Figma's "Fill" section) ───────────────────────

function buildFillSection(el: Element, onChange: () => void, tokens: ScannedToken[] = []): HTMLDivElement {
  const { root, body } = createSection({ title: 'Fill', defaultOpen: true });
  const html = el as HTMLElement;
  body.appendChild(
    makeColorRow('', el, 'backgroundColor', val => {
      html.style.backgroundColor = val;
      onChange();
    }, tokens),
  );
  return root;
}

// ─── Stroke — border (Figma's "Stroke" section) ──────────────────────────────

function buildStrokeSection(el: Element, onChange: () => void, tokens: ScannedToken[] = []): HTMLDivElement {
  const { root, body } = createSection({ title: 'Stroke', defaultOpen: true });
  const html = el as HTMLElement;

  body.appendChild(
    makeColorRow('', el, 'borderColor', val => {
      html.style.borderColor = val;
      onChange();
    }, tokens),
  );

  const bWidth = parseFloat(cs(el).borderTopWidth) || 0;
  body.appendChild(
    makePxInput('Width', bWidth, val => {
      html.style.borderWidth = val === null ? '' : `${val}px`;
      onChange();
    }),
  );

  const styleOptions = ['none', 'solid', 'dashed', 'dotted', 'double'];
  const currentStyle = cs(el).borderTopStyle || 'none';
  body.appendChild(
    makeSelectRow('Style', styleOptions, currentStyle, val => {
      html.style.borderStyle = val;
      onChange();
    }),
  );

  return root;
}

// ─── Effects — shadow (Figma's "Effects" section) ────────────────────────────

function buildEffectsSection(el: Element, onChange: () => void): HTMLDivElement {
  const { root, body } = createSection({ title: 'Effects', defaultOpen: true });
  const html = el as HTMLElement;

  const shadowCss = cs(el).boxShadow || 'none';
  const currentShadow = matchShadow(shadowCss);
  body.appendChild(
    makeShadowRow(currentShadow?.key ?? 'custom', (preset: ShadowPreset | null) => {
      if (!preset) return;
      html.style.boxShadow = preset.value;
      onChange();
    }),
  );

  return root;
}

// ─── Reusable control builders ────────────────────────────────────────────────

type SizeUnit = 'px' | '%' | 'auto';

function makeUnitInput(
  label: string,
  initial: { value: number; unit: SizeUnit },
  units: SizeUnit[],
  onSet: (next: { value: number; unit: SizeUnit }) => void,
): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'two-col';

  const lbl = document.createElement('div');
  lbl.className = 'control-label';
  lbl.textContent = label;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;align-items:center;gap:4px;';

  const num = document.createElement('input');
  num.type = 'number';
  num.className = 'text-input';
  num.style.cssText = 'width:52px;';
  num.min = '0';
  num.value = String(Math.round(initial.value));
  num.disabled = initial.unit === 'auto';

  const sel = document.createElement('select');
  sel.className = 'text-input';
  sel.style.cssText = 'width:54px;';
  for (const u of units) {
    const o = document.createElement('option');
    o.value = u;
    o.textContent = u;
    if (u === initial.unit) o.selected = true;
    sel.appendChild(o);
  }

  let currentUnit: SizeUnit = initial.unit;
  let currentValue = initial.value;

  num.addEventListener('input', () => {
    const v = parseFloat(num.value);
    if (isNaN(v)) return;
    currentValue = v;
    onSet({ value: currentValue, unit: currentUnit });
  });

  sel.addEventListener('change', () => {
    currentUnit = sel.value as SizeUnit;
    num.disabled = currentUnit === 'auto';
    onSet({ value: currentValue, unit: currentUnit });
  });

  wrap.append(num, sel);
  row.append(lbl, wrap);
  return row;
}

interface IconRowOption {
  value: string;
  label: string;
  icon: string;
}

function makeIconRow(label: string, options: IconRowOption[], current: string, onSelect: (val: string) => void): HTMLDivElement {
  const bar = document.createElement('div');
  bar.className = 'segmented';

  const refresh = (active: string) => {
    bar.querySelectorAll('button').forEach(btn => {
      (btn as HTMLButtonElement).dataset.active = (btn as HTMLButtonElement).dataset.value === active ? 'true' : 'false';
    });
  };

  for (const opt of options) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'segmented-btn segmented-btn-icon';
    btn.title = opt.label;
    btn.dataset.value = opt.value;
    btn.innerHTML = opt.icon;
    btn.addEventListener('click', () => {
      onSelect(opt.value);
      refresh(opt.value);
    });
    bar.appendChild(btn);
  }
  refresh(current);

  // When no label is passed (Figma's icon rows convey meaning through icons
  // alone — there's no "Direction" / "Justify" label cluttering the rail),
  // return the bar directly so it stretches full-width in the section body.
  if (!label) return bar as unknown as HTMLDivElement;

  const row = document.createElement('div');
  row.className = 'two-col';
  const lbl = document.createElement('div');
  lbl.className = 'control-label';
  lbl.textContent = label;
  row.append(lbl, bar);
  return row;
}

function makeTokenAwarePxInput(label: string, current: number, scale: SpacingStop[], onSet: (val: number | null) => void): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'two-col';

  const lbl = document.createElement('div');
  lbl.className = 'control-label';
  lbl.textContent = label;

  // Click-to-pick cell mirroring the Padding / Margin spacing input. The
  // previous design used a scrub input + a separate "radius/lg" chip
  // button — two affordances for the same task, and inconsistent with
  // how Spacing already worked. One click on the cell opens the token
  // picker; the picker dropdown shows token names alongside px values.
  const cell = document.createElement('button');
  cell.type = 'button';
  cell.className = 'figma-pad-cell token-pick-cell';

  const value = document.createElement('span');
  value.className = 'figma-pad-value';

  const display = (v: number): void => {
    value.textContent = String(Math.round(v));
    const stop = findStop(v, scale);
    cell.dataset.scale = stop || v === 0 ? 'match' : 'off';
  };
  display(current);

  cell.appendChild(value);
  cell.addEventListener('click', () => {
    openTokenPicker(cell, scale, stop => {
      display(stop.value);
      onSet(stop.value);
    });
  });

  row.append(lbl, cell);
  return row;
}

function openTokenPicker(anchor: HTMLElement, scale: SpacingStop[], onPick: (stop: SpacingStop) => void): void {
  const shadowRoot = anchor.getRootNode() as ShadowRoot;
  const rect = anchor.getBoundingClientRect();

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;';
  overlay.addEventListener('click', () => overlay.remove());

  const menu = document.createElement('div');
  menu.className = 'popover';
  menu.style.cssText = `top:${rect.bottom + 4}px;left:${rect.left}px;padding:4px;min-width:140px;`;
  menu.addEventListener('click', e => e.stopPropagation());

  for (const stop of scale) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'token-picker-option';
    btn.style.cssText = 'display:flex;justify-content:space-between;width:100%;';
    const left = document.createElement('span');
    left.textContent = stop.label;
    const right = document.createElement('span');
    right.style.opacity = '0.6';
    right.textContent = `${stop.value}px`;
    btn.append(left, right);
    btn.addEventListener('click', () => {
      onPick(stop);
      overlay.remove();
    });
    menu.appendChild(btn);
  }

  overlay.appendChild(menu);
  shadowRoot.appendChild(overlay);
}

function makePxInput(label: string, current: number, onSet: (val: number | null) => void): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'two-col';

  const lbl = document.createElement('div');
  lbl.className = 'control-label';
  lbl.textContent = label;

  const scrub = buildScrubInput({
    unit: 'px',
    initial: current,
    min: 0,
    onChange: onSet,
  });

  row.append(lbl, scrub.root);
  return row;
}

// Builds the `.scrub` markup (handle + number input) and wires the
// drag-to-scrub behaviour. The handle becomes a horizontal-drag affordance:
// click-and-drag changes the value at 1 unit / px, Shift = ×10, Alt = ÷10.
// Returns the root + value-setter so callers (e.g. token-aware chip) can
// update the displayed value when the picker fires.
interface ScrubControls {
  root: HTMLDivElement;
  setValue: (next: number) => void;
}

function buildScrubInput(opts: {
  unit: string;
  initial: number;
  min?: number;
  max?: number;
  onChange: (val: number | null) => void;
}): ScrubControls {
  const root = document.createElement('div');
  root.className = 'scrub';

  const handle = document.createElement('span');
  handle.className = 'scrub-handle';
  handle.textContent = opts.unit;
  handle.title = 'Drag horizontally to scrub. Shift = ×10, Alt = ÷10.';

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'scrub-input';
  if (opts.min !== undefined) input.min = String(opts.min);
  if (opts.max !== undefined) input.max = String(opts.max);
  input.step = '1';
  input.value = String(Math.round(opts.initial));

  root.append(handle, input);

  let value = opts.initial;

  const clamp = (n: number) => {
    let v = n;
    if (opts.min !== undefined) v = Math.max(opts.min, v);
    if (opts.max !== undefined) v = Math.min(opts.max, v);
    return v;
  };

  const setValue = (next: number) => {
    value = clamp(next);
    const rounded = Math.round(value);
    input.value = String(rounded);
    opts.onChange(rounded);
  };

  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    if (Number.isNaN(v)) {
      opts.onChange(null);
      return;
    }
    value = v;
    opts.onChange(v);
  });

  attachScrub(handle, () => value, setValue);

  return { root, setValue };
}

function attachScrub(handle: HTMLElement, getValue: () => number, setValue: (next: number) => void): void {
  handle.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    handle.classList.add('scrub-handle-active');
    const startX = e.clientX;
    const startValue = getValue();

    const onMove = (ev: PointerEvent) => {
      const sensitivity = ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1;
      const dx = ev.clientX - startX;
      setValue(startValue + dx * sensitivity);
    };

    const cleanup = (ev: PointerEvent) => {
      handle.releasePointerCapture(ev.pointerId);
      handle.classList.remove('scrub-handle-active');
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', cleanup);
      handle.removeEventListener('pointercancel', cleanup);
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', cleanup);
    handle.addEventListener('pointercancel', cleanup);
  });
}

function makeColorRow(
  label: string,
  el: Element,
  cssProperty: 'backgroundColor' | 'borderColor' | 'color',
  onSet: (val: string) => void,
  tokens: ScannedToken[] = [],
): HTMLDivElement {
  const chip = createColorChip({
    el,
    cssProperty,
    onChange: onSet,
    tokens,
  });

  // When no label is passed (the new Figma section split lets the section
  // header carry the meaning, e.g. "Fill"), render the chip standalone — the
  // two-col grid would otherwise reserve an empty label column.
  if (!label) return chip;

  const row = document.createElement('div');
  row.className = 'two-col';
  const lbl = document.createElement('div');
  lbl.className = 'control-label';
  lbl.textContent = label;
  row.append(lbl, chip);
  return row;
}

function makeRangeInput(
  label: string,
  current: number,
  min: number,
  max: number,
  unit: string,
  onSet: (val: number | null) => void,
): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'two-col';

  const lbl = document.createElement('div');
  lbl.className = 'control-label';
  lbl.textContent = label;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;align-items:center;gap:4px;';

  const range = document.createElement('input');
  range.type = 'range';
  range.min = String(min);
  range.max = String(max);
  range.value = String(current);
  range.style.cssText = 'width:60px;';

  const num = document.createElement('input');
  num.type = 'number';
  num.className = 'text-input';
  num.style.cssText = 'width:42px;';
  num.min = String(min);
  num.max = String(max);
  num.value = String(current);

  const unitLbl = document.createElement('span');
  unitLbl.className = 'control-label';
  unitLbl.textContent = unit;
  unitLbl.style.opacity = '0.5';

  range.addEventListener('input', () => {
    num.value = range.value;
    const v = parseFloat(range.value);
    onSet(isNaN(v) ? null : v);
  });
  num.addEventListener('input', () => {
    range.value = num.value;
    const v = parseFloat(num.value);
    onSet(isNaN(v) ? null : v);
  });

  wrap.append(range, num, unitLbl);
  row.append(lbl, wrap);
  return row;
}

function makeShadowRow(currentKey: string, onSelect: (preset: ShadowPreset | null) => void): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'two-col';

  const lbl = document.createElement('div');
  lbl.className = 'control-label';
  lbl.textContent = 'Shadow';

  const sel = document.createElement('select');
  sel.className = 'text-input';
  for (const preset of SHADOW_PRESETS) {
    const o = document.createElement('option');
    o.value = preset.key;
    o.textContent = preset.label;
    if (preset.key === currentKey) o.selected = true;
    sel.appendChild(o);
  }
  if (currentKey === 'custom') {
    const o = document.createElement('option');
    o.value = 'custom';
    o.textContent = 'Custom';
    o.selected = true;
    sel.appendChild(o);
  }
  sel.addEventListener('change', () => {
    const preset = SHADOW_PRESETS.find(p => p.key === sel.value);
    onSelect(preset ?? null);
  });

  row.append(lbl, sel);
  return row;
}

function makeSelectRow(label: string, options: string[], current: string, onSelect: (val: string) => void): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'two-col';

  const lbl = document.createElement('div');
  lbl.className = 'control-label';
  lbl.textContent = label;

  const sel = document.createElement('select');
  sel.className = 'text-input';
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    if (opt === current) o.selected = true;
    sel.appendChild(o);
  }
  sel.addEventListener('change', () => onSelect(sel.value));

  row.append(lbl, sel);
  return row;
}
