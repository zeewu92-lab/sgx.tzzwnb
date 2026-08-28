import { ACCENT, INK } from '../../constants/colors.js';
import { LOCALE_MAP } from '../../constants/languages.js';
import { COUNTRIES } from '../../constants/worldCities.js';
import { getTzCoords, projectToGlobe } from './earthCoords.js';
import earthImg from '../../assets/earth-hero.png';

// 這張地球鏡頭正對著的經緯度（大約對準東南亞／澳洲一帶），跟素材圖的取景角度搭配。
// 之後如果換一張取景角度不同的地球圖，只要調整這兩個數字，所有城市光點會自動重新對位，
// 完全不用重新量測座標。
const CENTER_LAT = 8;
const CENTER_LON = 115;

// 地球圓形本體佔容器寬度的比例、圓心位置（%）——光點的 %left / %top 都是以這個圓為基準換算
const GLOBE_RADIUS_PCT = 42;
const GLOBE_CENTER_PCT = 50;

export function EarthHero({ clocks, homeClock, now, lang, t, onTapCity }) {
  const dots = clocks
    .map((c) => {
      const coords = getTzCoords(c.tz);
      if (!coords) return null;
      const proj = projectToGlobe(coords[0], coords[1], CENTER_LAT, CENTER_LON);
      if (!proj) return null;
      const country = COUNTRIES.find((x) => x.id === c.countryId);
      const name = country ? country.name[lang] : c.tz;
      const timeStr = new Intl.DateTimeFormat(LOCALE_MAP[lang], {
        timeZone: c.tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now);
      const left = GLOBE_CENTER_PCT + proj.x * GLOBE_RADIUS_PCT;
      const top = GLOBE_CENTER_PCT - proj.y * GLOBE_RADIUS_PCT;
      const isHome = homeClock && c.id === homeClock.id;
      return { id: c.id, name, timeStr, left, top, isHome, edge: proj.edge };
    })
    .filter(Boolean)
    // 靠近邊緣的光點先畫，正面中央的光點蓋在最上層，名稱標籤才不會被邊緣的蓋住
    .sort((a, b) => (a.edge === b.edge ? 0 : a.edge ? -1 : 1));

  return (
    <div className="eh-wrap">
      <div className="eh-stars" />
      <div className="eh-globe-shell">
        <img src={earthImg} alt="" className="eh-globe-img" draggable={false} />
        <div className="eh-glow" />
        <div className="eh-rim" />
      </div>

      <div className="eh-dots">
        {dots.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onTapCity && onTapCity(d.id)}
            className="eh-dot-btn"
            style={{ left: `${d.left}%`, top: `${d.top}%`, opacity: d.edge ? 0.55 : 1 }}
          >
            <span className={`eh-dot${d.isHome ? ' eh-dot-home' : ''}`} />
            <span className="eh-label">
              <b>{d.name}</b>
              <small>{d.timeStr}</small>
            </span>
          </button>
        ))}
      </div>

      <style>{`
        .eh-wrap {
          position: relative;
          width: 100%;
          max-width: 360px;
          aspect-ratio: 1 / 1;
          max-height: 300px;
          margin: 4px auto 8px;
          border-radius: 24px;
          overflow: hidden;
          background: radial-gradient(circle at 50% 38%, #0e2038 0%, #071426 62%, #040b18 100%);
        }
        .eh-stars {
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(circle at 12% 18%, rgba(255,255,255,.85) 0 1px, transparent 1.6px),
            radial-gradient(circle at 82% 12%, rgba(255,255,255,.6) 0 1px, transparent 1.6px),
            radial-gradient(circle at 92% 55%, rgba(255,255,255,.7) 0 1px, transparent 1.6px),
            radial-gradient(circle at 8% 70%, rgba(255,255,255,.5) 0 1px, transparent 1.6px),
            radial-gradient(circle at 25% 88%, rgba(255,255,255,.65) 0 1px, transparent 1.6px),
            radial-gradient(circle at 70% 90%, rgba(255,255,255,.45) 0 1px, transparent 1.6px),
            radial-gradient(circle at 55% 8%, rgba(255,255,255,.55) 0 1px, transparent 1.6px);
          background-size: 100% 100%;
          opacity: 0.9;
        }
        .eh-globe-shell {
          position: absolute;
          left: 50%; top: 50%;
          width: ${GLOBE_RADIUS_PCT * 2}%;
          aspect-ratio: 1 / 1;
          transform: translate(-50%, -50%);
        }
        .eh-globe-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          animation: eh-sway 24s ease-in-out infinite;
          transform-origin: 50% 50%;
          user-select: none;
          -webkit-user-drag: none;
        }
        @keyframes eh-sway {
          0%   { transform: rotate(-1.4deg) scale(1); }
          50%  { transform: rotate(1.4deg) scale(1.015); }
          100% { transform: rotate(-1.4deg) scale(1); }
        }
        .eh-glow {
          position: absolute;
          inset: -6%;
          border-radius: 50%;
          pointer-events: none;
          box-shadow:
            0 0 26px 6px rgba(90,160,255,.35),
            0 0 60px 18px rgba(50,120,255,.16);
        }
        .eh-rim {
          position: absolute;
          inset: 2%;
          border-radius: 50%;
          pointer-events: none;
          box-shadow: inset -14px -8px 30px rgba(0,0,0,.55);
        }
        .eh-dots { position: absolute; inset: 0; }
        .eh-dot-btn {
          position: absolute;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          line-height: 1;
        }
        .eh-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 0 6px 2px rgba(255,255,255,.65);
        }
        .eh-dot-home {
          width: 9px; height: 9px;
          background: ${ACCENT};
          box-shadow: 0 0 0 3px rgba(108,123,224,.28), 0 0 8px 2px ${ACCENT};
        }
        .eh-label {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1px 5px;
          border-radius: 8px;
          background: rgba(7,20,38,.55);
          backdrop-filter: blur(2px);
          white-space: nowrap;
        }
        .eh-label b {
          font-size: 9.5px;
          font-weight: 700;
          color: #fff;
        }
        .eh-label small {
          font-family: 'Quicksand', sans-serif;
          font-size: 9px;
          color: rgba(255,255,255,.8);
        }
      `}</style>
    </div>
  );
}
