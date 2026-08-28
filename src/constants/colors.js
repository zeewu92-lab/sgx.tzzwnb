export const INK = 'var(--ink)';

export const INK_SOFT = 'var(--ink-soft)';

export const ACCENT = 'var(--accent, #6C7BE0)';

export const DANGER = '#FF004A';

export const MINT = '#3FBF9B';

export const CARD_BG = 'var(--card-bg)';

export const CARD_BORDER = '1px solid var(--card-border)';

export const INPUT_BG = 'var(--input-bg)';

export const CARE_MODE_VARS = {
  '--ink': '#57565C',
  '--ink-soft': 'rgba(87,86,92,0.55)',
  '--card-bg': '#F1F1F1',
  '--card-border': '#E4E4E7',
  '--accent': '#8B8B92',
};

export const COLOR_TAGS = [
  { id: 'indigo', hex: '#6C7BE0' },
  { id: 'mint', hex: '#3FBF9B' },
  { id: 'amber', hex: '#F2A65A' },
  { id: 'rose', hex: '#E8779C' },
  { id: 'violet', hex: '#A66CE0' },
  { id: 'sky', hex: '#4FB4E0' },
  { id: 'sage', hex: '#7CC576' },
  { id: 'coral', hex: '#E86C5E' },
];

export const ICONS = ['⭐', '❤️', '📚', '🎉', '🏅️', '🎂️', '✈️'];

export const CARE_ICONS = ['🕯️', '🪦'];

export const CARE_COLOR_TAGS = [
  { id: 'care-deep', hex: '#26262B' },
  { id: 'care-mid', hex: '#5B5B63' },
  { id: 'care-light', hex: '#96969E' },
];

export function colorHex(id) { return (COLOR_TAGS.find(c => c.id === id) || CARE_COLOR_TAGS.find(c => c.id === id) || COLOR_TAGS[0]).hex; }

export const SELECT_STYLE = { border: CARD_BORDER, background: INPUT_BG, color: INK };

export const SELECT_CLASS = 'px-2 py-2 rounded-lg text-sm outline-none flex-1 min-w-0';

export function glass(extra = {}) { return { background: CARD_BG, border: CARD_BORDER, boxShadow: '0 2px 10px rgba(35,39,51,0.05)', ...extra }; }

export const ICON_SELECTED_GLASS = {
  background: 'rgba(255,255,255,0.55)',
  backdropFilter: 'blur(12px) saturate(180%)',
  WebkitBackdropFilter: 'blur(12px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.5)',
  boxShadow: '0 2px 8px rgba(31,38,135,0.12)',
};

export function iconPickStyle(selected, extra = {}) {
  return selected ? { ...ICON_SELECTED_GLASS, ...extra } : { background: 'transparent', border: '1px solid transparent', ...extra };
}

export const ACCENT_CANVAS_HEX = '#6C7BE0';

export const AUTH_GLASS = {
  background: 'rgba(255,255,255,0.55)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.4)',
  boxShadow: '0 8px 32px rgba(31,38,135,0.18)',
};
