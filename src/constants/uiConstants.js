export const INK = 'var(--ink)';
export const INK_SOFT = 'var(--ink-soft)';
export const ACCENT = 'var(--accent, #6C7BE0)';
export const DANGER = '#FF004A';
export const MINT = '#3FBF9B';
export const CARD_BG = 'var(--card-bg)';
export const CARD_BORDER = '1px solid var(--card-border)';
export const INPUT_BG = 'var(--input-bg)';

export function accentAlpha(hexAlpha) {
  const pct = (parseInt(hexAlpha, 16) / 255) * 100;
  return `color-mix(in srgb, ${ACCENT} ${pct.toFixed(1)}%, transparent)`;
}
export const SELECT_STYLE = {
  border: CARD_BORDER,
  background: INPUT_BG,
  color: INK,
};

export const SELECT_CLASS =
  'px-2 py-2 rounded-lg text-sm outline-none flex-1 min-w-0';
