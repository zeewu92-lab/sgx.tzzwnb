import { ACCENT, CARD_BORDER, INK, INK_SOFT } from '../../constants/colors.js';

function hourFraction(tz, now) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour').value) % 24;
  const m = Number(parts.find((p) => p.type === 'minute').value);
  return (h + m / 60) / 24;
}

// 24 小時時間軸：同一條 00–24 的刻度尺上，用每個城市自己的「當地小時」標出一個點，
// 所以就算大家時差都不同，也能在同一條軸上一眼比較彼此現在大概是白天還晚上。
export function WorldTimeTimeline({ clocks, homeClock, now, lang, t }) {
  if (!clocks || clocks.length === 0) return null;
  const caption = t.timelineCaption || (lang === 'zh' ? '一眼看懂，世界的現在' : "The world's now, at a glance");

  return (
    <div className="wt-wrap">
      <p className="wt-caption">{caption}</p>
      <div className="wt-bar">
        <div className="wt-track" />
        {[0, 6, 12, 18, 24].map((h) => (
          <div key={h} className="wt-tick" style={{ left: `${(h / 24) * 100}%` }}>
            <span className="wt-tick-line" />
            <span className="wt-tick-label">{String(h).padStart(2, '0')}</span>
          </div>
        ))}
        {clocks.map((c) => {
          const isHome = homeClock && c.id === homeClock.id;
          const frac = hourFraction(c.tz, now);
          return (
            <span
              key={c.id}
              className="wt-marker"
              title={c.tz}
              style={{
                left: `${frac * 100}%`,
                background: isHome ? ACCENT : INK_SOFT,
                width: isHome ? 9 : 7,
                height: isHome ? 9 : 7,
                zIndex: isHome ? 2 : 1,
              }}
            />
          );
        })}
      </div>

      <style>{`
        .wt-wrap { padding: 2px 2px 6px; }
        .wt-caption { font-size: 11px; color: ${INK_SOFT}; margin-bottom: 8px; text-align: center; }
        .wt-bar { position: relative; height: 28px; margin: 0 4px; }
        .wt-track {
          position: absolute;
          left: 0; right: 0; top: 4px;
          height: 4px;
          border-radius: 2px;
          background: linear-gradient(90deg, #1b2a44 0%, #3a5a8c 25%, #f3c969 50%, #3a5a8c 75%, #1b2a44 100%);
          opacity: 0.85;
        }
        .wt-tick { position: absolute; top: 0; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; }
        .wt-tick-line { width: 1px; height: 10px; background: ${CARD_BORDER.includes('var') ? 'var(--card-border)' : CARD_BORDER}; opacity: .6; }
        .wt-tick-label { font-size: 9px; color: ${INK_SOFT}; margin-top: 2px; }
        .wt-marker {
          position: absolute;
          top: 6px;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          box-shadow: 0 0 0 2px #fff;
        }
      `}</style>
    </div>
  );
}
