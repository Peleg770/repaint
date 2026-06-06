import { computeChanges, type Change, type Snapshot } from './diff';

export interface EditedElement {
  el: Element;
  snapshot: Snapshot;
  classChanges?: { added: string[]; removed: string[] };
}

export function buildSessionPrompt(elements: EditedElement[]): string {
  const withDiff = elements
    .map(({ el, snapshot, classChanges }) => ({ el, changes: computeChanges(snapshot, el), classChanges }))
    .filter(e => e.changes.length > 0 || (e.classChanges && (e.classChanges.added.length > 0 || e.classChanges.removed.length > 0)));
  if (withDiff.length === 0) return '';
  if (withDiff.length === 1) return buildSingleElementPrompt(withDiff[0].el, withDiff[0].changes, withDiff[0].classChanges);
  return buildMultiElementPrompt(withDiff);
}

function buildSingleElementPrompt(el: Element, changes: Change[], classChanges?: { added: string[]; removed: string[] }): string {
  const url = window.location.href;
  return `# Repaint change request

Source: \`${url}\`

${formatTargetSection(el, '## Target')}

## Changes

${formatClassChanges(classChanges)}${formatChanges(changes, el)}

## Rules
${RULES}

## After applying
${PR_FOLLOWUP}
`;
}

function buildMultiElementPrompt(items: { el: Element; changes: Change[]; classChanges?: { added: string[]; removed: string[] } }[]): string {
  const url = window.location.href;
  const sections = items
    .map(({ el, changes, classChanges }, i) => {
      const heading = `## Element ${i + 1}: \`<${el.tagName.toLowerCase()}>\` ${describeSelector(el)}`;
      return `${formatTargetSection(el, heading)}\n\n### Changes\n\n${formatClassChanges(classChanges)}${formatChanges(changes, el)}`;
    })
    .join('\n\n---\n\n');

  return `# Repaint change request (${items.length} elements)

Source: \`${url}\`

Apply all changes below as one cohesive change set.

${sections}

## Rules
${RULES}

## After applying
${PR_FOLLOWUP}
`;
}

function formatTargetSection(el: Element, heading: string): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id || '';
  const dataAttrs = Array.from(el.attributes)
    .filter(a => a.name.startsWith('data-') && a.name !== 'data-repaint')
    .map(a => `${a.name}="${a.value}"`);
  const selector = describeSelector(el);
  const ancestorChain = describeAncestorChain(el, 4);
  const fileHint = inferFileHint(el, ancestorChain);
  const text = leafTextHint(el);

  const idLine = id ? `- ID: \`${id}\`\n` : '';
  const dataLine = dataAttrs.length ? `- Data attrs: ${dataAttrs.join(', ')}\n` : '';
  const textLine = text ? `- Visible text: "${text}"\n` : '';
  const fileLine = fileHint ? `- Likely source: ${fileHint}\n` : '';

  return `${heading}
- Tag: \`<${tag}>\`
- Selector: \`${selector}\`
${textLine}${idLine}${dataLine}${fileLine}- Ancestors (outer to inner):
${ancestorChain.map(s => '  - `' + s + '`').join('\n')}`;
}

function leafTextHint(el: Element): string {
  if (el.children.length > 0) return '';
  const raw = (el.textContent || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  return raw.length > 30 ? raw.slice(0, 29) + '...' : raw;
}

function formatClassChanges(classChanges?: { added: string[]; removed: string[] }): string {
  if (!classChanges) return '';
  const lines: string[] = [];
  for (const cls of classChanges.removed) lines.push(`- Class removed: \`${cls}\``);
  for (const cls of classChanges.added)   lines.push(`- Class added: \`${cls}\``);
  return lines.length ? lines.join('\n') + '\n' : '';
}

function formatChanges(changes: Change[], el: Element): string {
  const lines: string[] = [];

  // Collect CSS classes managed by variant swaps to suppress raw class diff noise.
  const variantManagedClasses = new Set<string>();
  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith('data-repaint-variant-classes-')) {
      for (const cls of attr.value.split(/\s+/)) variantManagedClasses.add(cls);
    }
  }

  const grouped = groupChanges(changes);

  if (grouped.variantChanges.length) {
    lines.push('Variants (update template input bindings, not the rendered classes):');
    for (const c of grouped.variantChanges) {
      const from = c.from ? `"${c.from}"` : '(default)';
      const to = c.to ? `"${c.to}"` : '(removed)';
      lines.push(`- Set ${c.name}=${to} on <${c.componentTag}> (was ${from})`);
    }
    lines.push('');
  }

  const filteredClassAdds = grouped.classAdds.filter(c => !variantManagedClasses.has(c));
  const filteredClassRemoves = grouped.classRemoves.filter(c => !variantManagedClasses.has(c));
  if (filteredClassAdds.length || filteredClassRemoves.length) {
    lines.push('Classes:');
    for (const c of filteredClassAdds) lines.push(`- Add \`${c}\``);
    for (const c of filteredClassRemoves) lines.push(`- Remove \`${c}\``);
    lines.push('');
  }

  if (grouped.styleAdds.length || grouped.styleChanges.length || grouped.styleRemoves.length) {
    lines.push('Inline styles:');
    for (const c of grouped.styleAdds) lines.push(`- Add \`${c.prop}: ${c.value}\``);
    for (const c of grouped.styleChanges) lines.push(`- Change \`${c.prop}\` from \`${c.from}\` to \`${c.to}\``);
    for (const c of grouped.styleRemoves) lines.push(`- Remove \`${c.prop}: ${c.value}\``);
    lines.push('');
  }

  if (grouped.attrChanges.length) {
    lines.push('Attributes:');
    for (const c of grouped.attrChanges) lines.push(c.to ? `- Add \`${c.attr}\`` : `- Remove \`${c.attr}\``);
    lines.push('');
  }

  if (grouped.textChanges.length) {
    lines.push('Text:');
    for (const c of grouped.textChanges) {
      const from = c.from.replace(/\s+/g, ' ').trim().slice(0, 60);
      const to = c.to.replace(/\s+/g, ' ').trim().slice(0, 60);
      lines.push(`- "${from}" -> "${to}"`);
    }
    lines.push(
      'Note: if the visible text is rendered from an i18n binding (`strings.X.Y` or `| cxTranslate`), update the key value in `libs/i18n/cx/<feature>/en.json` instead of rewriting the binding. Never modify `libs/i18n/ibm/`. For non-i18n bindings ({{ x }} / [innerText] bound to component state), leave the binding and report it to the user instead.',
      '',
    );
  }

  if (grouped.valueChanges.length) {
    lines.push('Form values:');
    for (const c of grouped.valueChanges) lines.push(`- "${c.from}" -> "${c.to}"`);
    lines.push('');
  }
  if (grouped.placeholderChanges.length) {
    lines.push('Placeholders:');
    for (const c of grouped.placeholderChanges) lines.push(`- "${c.from}" -> "${c.to}"`);
    lines.push('');
  }
  if (grouped.iconChanges.length) {
    lines.push('Icons (edit the template, not inline styles):');
    for (const c of grouped.iconChanges) {
      if (!c.from && c.to) {
        lines.push(`- Add \`<cxui-icon icon="${c.to}" />\` as first child`);
      } else if (c.from && !c.to) {
        lines.push(`- Remove \`<cxui-icon icon="${c.from}" />\` child`);
      } else if (c.from && c.to) {
        lines.push(`- Change icon "${c.from}" -> "${c.to}"`);
      }
    }
    lines.push('');
  }

  // Drop trailing blank lines so the prompt ends cleanly.
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

  return lines.join('\n');
}

interface GroupedChanges {
  classAdds: string[];
  classRemoves: string[];
  styleAdds: { prop: string; value: string }[];
  styleChanges: { prop: string; from: string; to: string }[];
  styleRemoves: { prop: string; value: string }[];
  attrChanges: { attr: string; to: boolean }[];
  textChanges: { from: string; to: string }[];
  valueChanges: { from: string; to: string }[];
  placeholderChanges: { from: string; to: string }[];
  iconChanges: { from: string | null; to: string | null }[];
  variantChanges: { name: string; from: string; to: string; componentTag: string }[];
}

function groupChanges(changes: Change[]): GroupedChanges {
  const g: GroupedChanges = {
    classAdds: [],
    classRemoves: [],
    styleAdds: [],
    styleChanges: [],
    styleRemoves: [],
    attrChanges: [],
    textChanges: [],
    valueChanges: [],
    placeholderChanges: [],
    iconChanges: [],
    variantChanges: [],
  };
  for (const c of changes) {
    switch (c.kind) {
      case 'class-add':
        g.classAdds.push(c.value);
        break;
      case 'class-remove':
        g.classRemoves.push(c.value);
        break;
      case 'style-add':
        g.styleAdds.push({ prop: c.prop, value: c.value });
        break;
      case 'style-change':
        g.styleChanges.push({ prop: c.prop, from: c.from, to: c.to });
        break;
      case 'style-remove':
        g.styleRemoves.push({ prop: c.prop, value: c.value });
        break;
      case 'attr':
        g.attrChanges.push({ attr: c.attr, to: c.to });
        break;
      case 'text':
        g.textChanges.push({ from: c.from, to: c.to });
        break;
      case 'value':
        g.valueChanges.push({ from: c.from, to: c.to });
        break;
      case 'placeholder':
        g.placeholderChanges.push({ from: c.from, to: c.to });
        break;
      case 'icon':
        g.iconChanges.push({ from: c.from, to: c.to });
        break;
      case 'variant':
        g.variantChanges.push({ name: c.name, from: c.from, to: c.to, componentTag: c.componentTag });
        break;
    }
  }
  return g;
}

const RULES = `1. Locate the source by stable identifier first: id, data-test-id, or a distinctive class. Fall back to tag plus visible text only when those do not disambiguate. Use the ancestors list to narrow the file path.
2. Apply each line under Changes exactly as written. Do not add changes that are not listed.
3. Prefer an existing utility or token class over an inline style when an equivalent exists.
4. If visible text is rendered from a binding (for example \`{{ value }}\` or \`[innerText]\`), do not rewrite the binding. Update class or style only, and report the bound text so the user can change the data source.
5. When a text change is requested and the visible text comes from an i18n binding (a \`strings.X.Y\` accessor or the \`| cxTranslate\` pipe), update the value of that key in \`libs/i18n/cx/<feature>/en.json\` instead of touching the template. Never modify \`libs/i18n/ibm/\` — IBM translations are owned by the IBM team.
6. After editing, report each file and line touched, with the before and after, so the user can verify the patch.`;

const PR_FOLLOWUP = `Once the edits are reported, ask the user: "Do you want to open a PR for these changes?"

If the user says yes, invoke the \`/cx-pr-create\` skill to handle the rest end-to-end: create a new branch off the current base, create a Jira ticket if one isn't already linked, and open the PR. Do not run \`git checkout\` / \`gh pr create\` manually — the skill orchestrates branch naming, Jira linkage, and PR body conventions for this repo.`;

function describeSelector(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `${tag}#${el.id}`;
  const classes = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean);
  if (classes.length === 0) return tag;
  const useful = classes
    .filter(c => !c.startsWith('tw-flex') && !c.startsWith('tw-items') && !c.startsWith('tw-justify') && !c.startsWith('tw-inline'))
    .slice(0, 4);
  return `${tag}${useful.map(c => '.' + c).join('')}`;
}

function describeAncestorChain(el: Element, depth: number): string[] {
  const chain: string[] = [];
  let cur: Element | null = el.parentElement;
  let n = 0;
  while (cur && n < depth && cur !== document.body) {
    const tag = cur.tagName.toLowerCase();
    const id = cur.id ? '#' + cur.id : '';
    const cls = (cur.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    const clsStr = cls.length ? '.' + cls.join('.') : '';
    chain.unshift(`${tag}${id}${clsStr}`);
    cur = cur.parentElement;
    n += 1;
  }
  return chain;
}

function inferFileHint(_el: Element, _chain: string[]): string | null {
  return null;
}


export interface ApplyResult {
  ok: boolean;
  path?: string;
  error?: string;
}

export async function postApply(prompt: string): Promise<ApplyResult> {
  // P1: clipboard-only. The in-bundle client POSTed to the Vite dev plugin's
  // /__repaint/apply endpoint; the extension has no such endpoint. A local apply
  // helper is the P2 path (direction plan D3/D4). For now the designer pastes
  // the prompt into Claude Code, or runs /repaint-apply paste.
  const copied = await copyToClipboard(prompt);
  if (!copied) return { ok: false, error: 'clipboard write failed' };
  return { ok: true, path: 'clipboard' };
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-9999px;';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      /* ignore */
    }
    ta.remove();
    return ok;
  }
}
