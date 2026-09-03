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
  // hexDark：關懷模式在深色模式下用的版本。淺色模式是「越深＝訊號越強」（care-deep 最接近黑），
  // 深色模式要保留同一套「強弱」語意，但顏色本身要反過來——最深的變最亮（在深色背景上最顯眼、
  // 對比最高），最淺的變最暗（最不顯眼），不然原本的深黑色徽章疊在深色背景上會幾乎看不見。
  { id: 'care-deep', hex: '#26262B', hexDark: '#E4E4E8' },
  { id: 'care-mid', hex: '#5B5B63', hexDark: '#A9A9B3' },
  { id: 'care-light', hex: '#96969E', hexDark: '#75757F' },
];

export function colorHex(id, isDark) {
  const tag = COLOR_TAGS.find(c => c.id === id) || CARE_COLOR_TAGS.find(c => c.id === id) || COLOR_TAGS[0];
  // 只有關懷模式的黑灰色（CARE_COLOR_TAGS）有 hexDark；一般彩色標籤沒有這個欄位，
  // 所以就算呼叫端一律傳 isDark 也不影響一般顏色，是安全、不會動到其他地方的改法。
  return (isDark && tag.hexDark) ? tag.hexDark : tag.hex;
}

// 在一塊實心色底上疊白色或深色文字/圖示，用哪個字色對比才夠——關懷模式深色模式下的
// hexDark 是偏亮的灰階色，這時疊白字幾乎看不見，要改疊深色字才行；一般彩色標籤大多
// 是中高彩度色，疊白字沒問題。用簡化版相對亮度公式判斷，不用另外分辨這個顏色是不是
// 關懷色，同一套邏輯就能兩邊都處理好。
export function contrastColor(hex) {
  const clean = (hex || '').replace('#', '');
  if (clean.length !== 6) return '#fff';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1A1A1D' : '#fff';
}

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
