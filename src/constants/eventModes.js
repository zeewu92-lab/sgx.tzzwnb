export const EVENT_MODES = [
  { id: 'birthday', labelKey: 'modeBirthday', hintKey: 'birthdayHint' },
  { id: 'companion', labelKey: 'modeCompanion', hintKey: 'modeCompanionHint' },
  { id: 'care', labelKey: 'modeCare', hintKey: 'careHint' },
  { id: 'anniversary', labelKey: 'modeAnniversary', hintKey: 'modeAnniversaryHint' },
  { id: 'regular', labelKey: 'modeRegular', hintKey: 'modeRegularHint' },
];

export const SCHEDULE_VIEW_MODES = [
  { id: 'year', labelKey: 'viewModeYear' },
  { id: 'month', labelKey: 'viewModeMonth' },
  { id: 'week', labelKey: 'viewModeWeek' },
];

export function eventModeFromEv(ev) {
  if (ev && ev.isBirthday) return 'birthday';
  if (ev && ev.isCare) return 'care';
  return (ev && ev.mode) || 'regular';
}

export const ICON_SUBMENUS = {
  '❤️': ['💏', '👩\u200d❤️\u200d💋\u200d👩', '👩\u200d❤️\u200d💋\u200d👨'],
  '🏅️': ['🥇', '🥈', '🥉', '🏆'],
};
