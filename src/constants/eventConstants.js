const COLOR_TAGS = [
  { id: 'indigo', hex: '#6C7BE0' },
  { id: 'mint', hex: '#3FBF9B' },
  { id: 'amber', hex: '#F2A65A' },
  { id: 'rose', hex: '#E8779C' },
  { id: 'violet', hex: '#A66CE0' },
  { id: 'sky', hex: '#4FB4E0' },
  { id: 'sage', hex: '#7CC576' },
  { id: 'coral', hex: '#E86C5E' },
];

const ICONS = ['⭐', '❤️', '📚', '🎉', '🏅️', '🎂️', '✈️'];
// 關懷模式（追悼／紀念用途）專用的圖示與顏色：固定用蠟燭、墓碑等圖示，
// 其餘自訂圖示沿用原本「＋」自訂功能；顏色改成深淺不一的黑灰色
const CARE_ICONS = ['🕯️', '🪦'];
const CARE_COLOR_TAGS = [
  { id: 'care-deep', hex: '#26262B' },
  { id: 'care-mid', hex: '#5B5B63' },
  { id: 'care-light', hex: '#96969E' },
];

const EVENT_MODES = [
  { id: 'birthday', labelKey: 'modeBirthday', hintKey: 'birthdayHint' },
  { id: 'companion', labelKey: 'modeCompanion', hintKey: 'modeCompanionHint' },
  { id: 'care', labelKey: 'modeCare', hintKey: 'careHint' },
  { id: 'anniversary', labelKey: 'modeAnniversary', hintKey: 'modeAnniversaryHint' },
  { id: 'regular', labelKey: 'modeRegular', hintKey: 'modeRegularHint' },
];

const ICON_SUBMENUS = {
  '❤️': ['💏', '👩\u200d❤️\u200d💋\u200d👩', '👩\u200d❤️\u200d💋\u200d👨'],
  '🏅️': ['🥇', '🥈', '🥉', '🏆'],
};  
const CAL_OPTIONS = [
  { id: 'gregory', label: { 'zh-TW': '西曆（不轉換）', en: 'Gregorian (no conversion)', ja: '西暦（変換なし）', ko: '양력(변환 없음)' } },
  { id: 'chinese', label: { 'zh-TW': '農曆', en: 'Lunar (Chinese)', ja: '旧暦', ko: '음력' } },
  { id: 'islamic', label: { 'zh-TW': '伊斯蘭曆', en: 'Islamic', ja: 'イスラム暦', ko: '이슬람력' } },
  { id: 'hebrew', label: { 'zh-TW': '希伯來曆', en: 'Hebrew', ja: 'ヘブライ暦', ko: '히브리력' } },
  { id: 'buddhist', label: { 'zh-TW': '佛曆', en: 'Buddhist', ja: '仏暦', ko: '불기' } },
  { id: 'japanese', label: { 'zh-TW': '日本曆', en: 'Japanese', ja: '和暦', ko: '일본력' } },
];

const LUNAR_MONTHS = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '臘月'];
