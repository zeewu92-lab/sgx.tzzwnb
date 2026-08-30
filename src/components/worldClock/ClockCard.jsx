import { useRef } from 'react';
import { Check } from 'lucide-react';
import { ACCENT, CARD_BG, CARD_BORDER, DANGER, INK, INK_SOFT } from '../../constants/colors.js';
import { LOCALE_MAP } from '../../constants/languages.js';
import { CITIES } from '../../constants/worldCities.js';
import { formatOffsetDiff, getOffsetMinutes, getTimeHMS, getUtcOffset } from '../../utils/timezone.js';

export function ClockRow({ clock, now, selectMode, selected, onLongPress, onTap, lang, t, compact, isHome, homeTz, hero }) {
  const timerRef = useRef(null);
  const firedRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const LONG_PRESS_MOVE_THRESHOLD = 10; // px：手指/滑鼠移動超過這個距離就視為在捲動或拖曳，不算「按住不動」
  const start = (e) => {
    firedRef.current = false;
    const point = e.touches ? e.touches[0] : e;
    startPosRef.current = { x: point.clientX, y: point.clientY };
    timerRef.current = setTimeout(() => { firedRef.current = true; onLongPress(clock.id); }, 500);
  };
  const clear = () => { if (timerRef.current) clearTimeout(timerRef.current); timerRef.current = null; };
  // 長按觸發前若偵測到手指/滑鼠移動超過門檻（例如在捲動時區清單），就取消這次長按判定，
  // 避免「長按=進入多選刪除模式」在使用者其實只是想捲動畫面時被誤觸發
  const move = (e) => {
    if (!timerRef.current) return;
    const point = e.touches ? e.touches[0] : e;
    const dx = point.clientX - startPosRef.current.x;
    const dy = point.clientY - startPosRef.current.y;
    if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_THRESHOLD) clear();
  };
  // 原本「目前位置」卡片（hero）雙擊會另外開一個時鐘詳情彈窗，這個互動已經移除——
  // 該視窗的內容現在直接常駐顯示在「世界時鐘」分頁裡（見 App() 裡 activeTab === 'clock'
  // 那段），不需要再靠雙擊才看得到，所以這裡跟其他時鐘列一樣，單擊一律直接呼叫 onTap
  // （hero 卡片的 onTap＝設為/取消目前位置）。
  const handleClick = () => {
    if (firedRef.current) { firedRef.current = false; return; }
    onTap(clock.id);
  };

  const city = CITIES.find(c => c.tz === clock.tz);
  const nameLabel = city ? city.name[lang] : clock.tz;
  const subLabel = city ? city.country[lang] : null;

  const timeStr = new Intl.DateTimeFormat(LOCALE_MAP[lang], { timeZone: clock.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
  const offsetStr = getUtcOffset(clock.tz, now);
  const localDay = now.getDate();
  const tzDay = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: clock.tz, day: 'numeric' }).format(now));
  const dayOffset = tzDay === localDay ? '' : tzDay > localDay ? t.tomorrow : t.yesterday;

  // 與目前位置的時差（僅在有設定目前位置，且這不是目前位置本身時顯示）
  let diffLabel = null;
  if (homeTz && !isHome) {
    const diffMinutes = getOffsetMinutes(clock.tz, now) - getOffsetMinutes(homeTz, now);
    diffLabel = diffMinutes === 0 ? t.sameAsCurrent : `${formatOffsetDiff(diffMinutes)}${t.diffHourSuffix}`;
  }

  const rowBg = selected ? 'rgba(255,0,74,0.10)' : isHome ? 'rgba(108,123,224,0.08)' : CARD_BG;
  const rowBorder = selected ? `1.5px solid ${DANGER}` : isHome ? `1.5px solid ${ACCENT}` : CARD_BORDER;

  if (hero) {
    return (
      <button
        onMouseDown={start} onMouseUp={clear} onMouseLeave={clear}
        onMouseMove={move} onTouchMove={move}
        onTouchStart={start} onTouchEnd={clear}
        onClick={handleClick}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' && e.shiftKey) || e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            onLongPress(clock.id);
          }
        }}
        className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl relative"
        style={{ background: selected ? 'rgba(255,0,74,0.10)' : 'rgba(108,123,224,0.08)', border: selected ? `1.5px solid ${DANGER}` : `1.5px solid ${ACCENT}`, userSelect: 'none', WebkitUserSelect: 'none' }}
      >
        {selectMode && (
          <span className="absolute flex items-center justify-center rounded" style={{ width: 17, height: 17, top: 6, left: 6, border: `1px solid ${selected ? DANGER : INK_SOFT}`, background: selected ? DANGER : 'rgba(255,255,255,0.9)', zIndex: 1 }}>
            {selected && <Check size={11} color="#fff" />}
          </span>
        )}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex flex-col items-start min-w-0">
            <span className="text-xs font-bold truncate" style={{ color: ACCENT }}>📍{t.currentLocation}</span>
            <span className="font-bold text-base truncate" style={{ color: INK }}>{nameLabel}</span>
          </div>
        </div>
        <div className="flex flex-col items-end flex-shrink-0 pl-3">
          <span className="font-bold tabular-nums whitespace-nowrap leading-none" style={{ fontFamily: "'Quicksand', sans-serif", fontSize: 28, color: selected ? DANGER : INK }}>{timeStr}</span>
          <span className="text-xs font-medium whitespace-nowrap mt-1" style={{ color: INK_SOFT }}>{offsetStr}{dayOffset ? `・${dayOffset}` : ''}</span>
        </div>
      </button>
    );
  }

  if (compact) {
    return (
      <button
        onMouseDown={start} onMouseUp={clear} onMouseLeave={clear}
        onMouseMove={move} onTouchMove={move}
        onTouchStart={start} onTouchEnd={clear}
        onClick={handleClick}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' && e.shiftKey) || e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            onLongPress(clock.id);
          }
        }}
        className="flex items-center justify-between px-2.5 py-2 rounded-2xl w-full min-w-0 relative"
        style={{ background: rowBg, border: rowBorder, userSelect: 'none', WebkitUserSelect: 'none' }}
      >
        {selectMode && (
          <span className="absolute flex items-center justify-center rounded" style={{ width: 14, height: 14, top: 4, left: 4, border: `1px solid ${selected ? DANGER : INK_SOFT}`, background: selected ? DANGER : 'rgba(255,255,255,0.9)', zIndex: 1 }}>
            {selected && <Check size={9} color="#fff" />}
          </span>
        )}
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="flex flex-col items-start min-w-0">
            <span className="font-bold text-xs truncate" style={{ color: INK, maxWidth: 62 }}>{nameLabel}</span>
            {isHome ? (
              <span className="text-[9px] font-bold truncate" style={{ color: ACCENT, maxWidth: 62 }}>📍{t.currentLocation}</span>
            ) : subLabel && (
              <span className="text-[9px] truncate" style={{ color: INK, maxWidth: 62 }}>{subLabel}</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end flex-shrink-0 pl-1.5">
          <span className="font-bold tabular-nums whitespace-nowrap" style={{ fontFamily: "'Quicksand', sans-serif", fontSize: 15, color: selected ? DANGER : INK }}>{timeStr}</span>
          <span className="text-[9px] whitespace-nowrap" style={{ color: INK_SOFT }}>{offsetStr}{dayOffset ? `・${dayOffset}` : ''}</span>
          {diffLabel && <span className="text-[9px] font-bold whitespace-nowrap" style={{ color: ACCENT }}>{diffLabel}</span>}
        </div>
      </button>
    );
  }

  return (
    <button
      onMouseDown={start} onMouseUp={clear} onMouseLeave={clear}
      onMouseMove={move} onTouchMove={move}
      onTouchStart={start} onTouchEnd={clear}
      onClick={handleClick}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' && e.shiftKey) || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          onLongPress(clock.id);
        }
      }}
      className="w-full flex items-center justify-between px-4 py-3 rounded-2xl relative"
      style={{ background: rowBg, border: rowBorder, userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      {selectMode && (
        <span className="absolute flex items-center justify-center rounded" style={{ width: 17, height: 17, top: 6, left: 6, border: `1px solid ${selected ? DANGER : INK_SOFT}`, background: selected ? DANGER : 'rgba(255,255,255,0.9)', zIndex: 1 }}>
          {selected && <Check size={11} color="#fff" />}
        </span>
      )}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex flex-col items-start min-w-0">
          <span className="font-bold text-sm truncate" style={{ color: INK }}>{nameLabel}</span>
          {isHome ? (
            <span className="text-xs font-bold truncate" style={{ color: ACCENT }}>📍{t.currentLocation}</span>
          ) : subLabel && (
            <span className="text-xs truncate" style={{ color: INK }}>{subLabel}</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end flex-shrink-0 pl-3">
        <span className="font-bold tabular-nums whitespace-nowrap" style={{ fontFamily: "'Quicksand', sans-serif", fontSize: 20, color: selected ? DANGER : INK }}>{timeStr}</span>
        <span className="text-xs whitespace-nowrap" style={{ color: INK_SOFT }}>{offsetStr}{dayOffset ? `・${dayOffset}` : ''}</span>
        {diffLabel && <span className="text-xs font-bold whitespace-nowrap" style={{ color: ACCENT }}>{diffLabel}</span>}
      </div>
    </button>
  );
}

export function AnalogClock({ tz, now, size = 220 }) {
  const { h, m, s, ms } = getTimeHMS(now, tz);
  const secDeg = (s + ms / 1000) * 6;
  const minDeg = (m + s / 60) * 6;
  const hourDeg = ((h % 12) + m / 60) * 30;

  const R = 100; // viewBox 半徑
  const ticks = [];
  for (let i = 0; i < 60; i++) {
    const deg = i * 6;
    const major = i % 5 === 0;
    const r1 = major ? 78 : 84;
    const r2 = 92;
    const rad = (deg * Math.PI) / 180;
    const x1 = 100 + r1 * Math.sin(rad), y1 = 100 - r1 * Math.cos(rad);
    const x2 = 100 + r2 * Math.sin(rad), y2 = 100 - r2 * Math.cos(rad);
    ticks.push(
      <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={INK} strokeOpacity={major ? 0.55 : 0.25} strokeWidth={major ? 2.2 : 1} strokeLinecap="round" />
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={{ flexShrink: 0 }}>
      <circle cx="100" cy="100" r="98" fill={CARD_BG} stroke={CARD_BORDER === '1px solid var(--card-border)' ? 'var(--card-border)' : CARD_BORDER} strokeWidth="1" />
      {ticks}
      <text x="100" y="38" textAnchor="middle" fontSize="16" fontWeight="700" fill={INK} fontFamily="'Quicksand', sans-serif">12</text>
      <text x="168" y="106" textAnchor="middle" fontSize="16" fontWeight="700" fill={INK} fontFamily="'Quicksand', sans-serif">3</text>
      <text x="100" y="172" textAnchor="middle" fontSize="16" fontWeight="700" fill={INK} fontFamily="'Quicksand', sans-serif">6</text>
      <text x="32" y="106" textAnchor="middle" fontSize="16" fontWeight="700" fill={INK} fontFamily="'Quicksand', sans-serif">9</text>
      {/* 時針 */}
      <line x1="100" y1="100" x2="100" y2="58" stroke={INK} strokeWidth="5" strokeLinecap="round"
        transform={`rotate(${hourDeg} 100 100)`} />
      {/* 分針 */}
      <line x1="100" y1="100" x2="100" y2="34" stroke={INK} strokeWidth="3.5" strokeLinecap="round"
        transform={`rotate(${minDeg} 100 100)`} />
      {/* 秒針 */}
      <line x1="100" y1="112" x2="100" y2="24" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round"
        transform={`rotate(${secDeg} 100 100)`} />
      <circle cx="100" cy="100" r="5" fill={ACCENT} />
    </svg>
  );
}
