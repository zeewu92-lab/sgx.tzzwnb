import { Check } from 'lucide-react';
import { ACCENT, INK } from '../../constants/colors.js';
import { accentAlpha } from '../../utils/accentAlpha.js';

export function AppearanceChoiceContent({ themeMode, setThemeMode, t, onClose }) {
  const options = [
    { id: 'system', label: t.appearanceModeSystem },
    { id: 'light', label: t.appearanceModeLight },
    { id: 'dark', label: t.appearanceModeDark },
  ];
  return (
    <div className="flex flex-col gap-1">
      {options.map(o => (
        <button
          key={o.id}
          onClick={() => { setThemeMode(o.id); onClose(); }}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold text-left"
          style={{ color: o.id === themeMode ? ACCENT : INK, background: o.id === themeMode ? accentAlpha('14') : 'transparent' }}
        >
          {o.label}
          {o.id === themeMode && <Check size={15} />}
        </button>
      ))}
    </div>
  );
}
