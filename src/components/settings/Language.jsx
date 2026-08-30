import { useState, useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { ACCENT, INK, INK_SOFT, glass } from '../../constants/colors.js';
import { LANGS, LANG_NAMES } from '../../constants/languages.js';
import { CAL_OPTIONS } from '../../constants/worldCities.js';
import { LanguageIcon } from '../icons/AppIcons.jsx';
import { openDropdownExclusive, useExclusiveDropdown } from '../../hooks/useOverlayTransition.js';
import { accentAlpha } from '../../utils/accentAlpha.js';

export function LangSwitcher({ lang, setLang }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useExclusiveDropdown('lang', open, () => setOpen(false));

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(v => {
          const next = !v;
          if (next) openDropdownExclusive('lang');
          return next;
        })}
        className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-full"
        style={glass({ color: INK })}
      >
        <LanguageIcon size={14} /> {LANG_NAMES[lang]}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 rounded-xl overflow-hidden z-20" style={{ ...glass(), width: 140, boxShadow: '0 10px 30px rgba(35,39,51,0.15)' }}>
          {LANGS.map(l => (
            <button
              key={l}
              onClick={() => { setLang(l); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm"
              style={{ color: l === lang ? ACCENT : INK, background: l === lang ? 'var(--card-border)' : 'transparent' }}
            >
              {LANG_NAMES[l]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function LanguageChoiceContent({ lang, setLang, onClose }) {
  return (
    <div className="flex flex-col gap-1">
      {LANGS.map(l => (
        <button
          key={l}
          onClick={() => { setLang(l); onClose(); }}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold text-left"
          style={{ color: l === lang ? ACCENT : INK, background: l === lang ? accentAlpha('14') : 'transparent' }}
        >
          {LANG_NAMES[l]}
          {l === lang && <Check size={15} />}
        </button>
      ))}
    </div>
  );
}

export function CalendarPrefChoiceContent({ enabledAltCalendars, setEnabledAltCalendars, lang, t }) {
  function toggle(id) {
    setEnabledAltCalendars(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs leading-relaxed mb-1" style={{ color: INK_SOFT }}>{t.calendarPrefHint}</p>
      {CAL_OPTIONS.filter(c => c.id !== 'gregory').map(c => {
        const active = enabledAltCalendars.includes(c.id);
        return (
          <button
            key={c.id}
            onClick={() => toggle(c.id)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold text-left"
            style={{ color: active ? ACCENT : INK, background: active ? accentAlpha('14') : 'transparent' }}
          >
            {c.label[lang]}
            {active && <Check size={15} />}
          </button>
        );
      })}
    </div>
  );
}
