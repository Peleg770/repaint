// Hardcoded design-token scales for BVC controls.
// cx-ui generated-tokens.scss currently only contains color tokens (--c-*).
// When spacing/radius/shadow tokens land there, replace these with parsed data.

export interface ShadowPreset {
  key: string;
  label: string;
  value: string;
}

export const SHADOW_PRESETS: ShadowPreset[] = [
  { key: 'none', label: 'None', value: '' },
  { key: 'sm', label: 'Small', value: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' },
  { key: 'md', label: 'Medium', value: '0 2px 6px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.04)' },
  { key: 'lg', label: 'Large', value: '0 4px 12px 0 rgba(0, 0, 0, 0.10), 0 2px 4px 0 rgba(0, 0, 0, 0.05)' },
  { key: 'xl', label: 'Extra Large', value: '0 8px 24px 0 rgba(0, 0, 0, 0.12), 0 4px 8px 0 rgba(0, 0, 0, 0.06)' },
];

export interface SpacingStop {
  value: number;
  label: string;
}

export const SPACING_SCALE: SpacingStop[] = [
  { value: 0, label: 'spacing/0' },
  { value: 2, label: 'spacing/0.5' },
  { value: 4, label: 'spacing/1' },
  { value: 6, label: 'spacing/1.5' },
  { value: 8, label: 'spacing/2' },
  { value: 12, label: 'spacing/3' },
  { value: 16, label: 'spacing/4' },
  { value: 20, label: 'spacing/5' },
  { value: 24, label: 'spacing/6' },
  { value: 32, label: 'spacing/8' },
  { value: 40, label: 'spacing/10' },
  { value: 48, label: 'spacing/12' },
  { value: 64, label: 'spacing/16' },
];

export const RADIUS_SCALE: SpacingStop[] = [
  { value: 0, label: 'radius/none' },
  { value: 2, label: 'radius/xs' },
  { value: 4, label: 'radius/sm' },
  { value: 6, label: 'radius/md' },
  { value: 8, label: 'radius/lg' },
  { value: 12, label: 'radius/xl' },
  { value: 9999, label: 'radius/full' },
];

export function findStop(value: number | null, scale: SpacingStop[]): SpacingStop | null {
  if (value === null) return null;
  return scale.find(s => s.value === value) ?? null;
}

export function matchShadow(cssValue: string): ShadowPreset | null {
  const trimmed = cssValue.trim();
  if (!trimmed || trimmed === 'none') return SHADOW_PRESETS[0];
  // Match by blur radius signature (third numeric token) — browsers normalize
  // rgba spacing so direct string comparison is fragile.
  const blurMatch = trimmed.match(/(\d+)px\s+(\d+)px\s+(\d+)px/);
  if (!blurMatch) return null;
  const blur = parseInt(blurMatch[3], 10);
  for (const preset of SHADOW_PRESETS) {
    if (!preset.value) continue;
    const m = preset.value.match(/(\d+)px\s+(\d+)px\s+(\d+)px/);
    if (m && parseInt(m[3], 10) === blur) return preset;
  }
  return null;
}
