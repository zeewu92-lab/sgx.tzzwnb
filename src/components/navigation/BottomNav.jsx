import { useState } from 'react';
import { Home, Calendar, Globe, User } from 'lucide-react';
import { ACCENT, CARD_BORDER, INK_SOFT } from '../../constants/colors.js';

// 中央 Logo：深色模式 / 淺色模式各一份圖檔，放在 public 目錄下即可自動套用。
// 淺色模式（背景較亮，如截圖）用深色/彩色版 Logo；深色模式用淺色版 Logo，避免對比不足。
export const BOTTOM_NAV_LOGO_SRC_LIGHT = '/nav-logo-light.png';
export const BOTTOM_NAV_LOGO_SRC_DARK = '/nav-logo-dark.png';

// 新順序：首頁 → 日程 → 中央 Logo → 世界時鐘 → 我的
export const BOTTOM_NAV_ITEMS = [
  { id: 'home', icon: Home, labelKey: 'navHome' },
  { id: 'schedule', icon: Calendar, labelKey: 'navSchedule' },
  { id: 'brand', icon: null, labelKey: null }, // 中央特殊處理，見下方渲染邏輯
  { id: 'clock', icon: Globe, labelKey: 'worldClock' },
  { id: 'profile', icon: User, labelKey: 'navProfile' },
];

export function BottomNavLogo({ active, theme = 'light', size = 26 }) {
  // 品牌圖示素材還沒放上去之前，用一個中性的實心圓點佔位（不是刻意畫的替代 Logo），
  // 圖片載入失敗時自動切換回這個佔位，素材一到位就會自動顯示正式圖檔。
  const [imgFailed, setImgFailed] = useState(false);
  const src = theme === 'dark' ? BOTTOM_NAV_LOGO_SRC_DARK : BOTTOM_NAV_LOGO_SRC_LIGHT;

  if (imgFailed) {
    return (
      <div
        className="rounded-full flex-shrink-0"
        style={{ width: size, height: size, background: active ? ACCENT : 'var(--card-border)', transition: 'background 150ms ease' }}
      />
    );
  }
  return (
    <img
      key={src}
      src={src}
      alt=""
      onError={() => setImgFailed(true)}
      className="flex-shrink-0"
      style={{ width: size, height: size, objectFit: 'contain', opacity: active ? 1 : 0.75, transition: 'opacity 150ms ease' }}
    />
  );
}

export function BottomNavigation({ activeTab, setActiveTab, t, theme = 'light' }) {
  return (
    <nav
      className="flex-shrink-0"
      style={{
        position: 'relative',
        zIndex: 30,
        background: 'var(--header-bg)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop: CARD_BORDER,
        // iOS Safe Area／Android 手勢導覽區：跟 Header 頂部安全區同一套做法（env() 在沒有
        // 安全區概念的環境下是 0，不影響一般網頁版），底部再固定留一點基礎間距。
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="max-w-md mx-auto w-full flex items-end justify-between px-2">
        {BOTTOM_NAV_ITEMS.map(item => {
          const active = activeTab === item.id;
          const isCenter = item.id === 'brand';
          const Icon = item.icon;

          if (isCenter) {
            // 中央 Logo：白色圓形浮出於導覽列上緣，仿截圖中的懸浮按鈕樣式，無文字標籤。
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="flex-1 flex flex-col items-center justify-end"
                style={{ minWidth: 0 }}
              >
                <span
                  className="flex items-center justify-center rounded-full flex-shrink-0"
                  style={{
                    width: 56,
                    height: 56,
                    marginTop: -28,
                    background: 'var(--card-bg, #fff)',
                    border: CARD_BORDER,
                    boxShadow: '0 6px 16px rgba(0,0,0,0.16)',
                  }}
                >
                  <BottomNavLogo active={active} theme={theme} size={26} />
                </span>
                <span style={{ height: 6 }} />
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2"
              style={{ minWidth: 0 }}
            >
              <Icon size={20} style={{ color: active ? ACCENT : INK_SOFT, transition: 'color 150ms ease' }} strokeWidth={active ? 2.4 : 2} />
              <span
                className="text-[10px] truncate"
                style={{
                  color: active ? ACCENT : INK_SOFT,
                  fontWeight: active ? 700 : 500,
                  maxWidth: '100%',
                }}
              >
                {t[item.labelKey]}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function SideNavigation({ activeTab, setActiveTab, t, theme = 'light' }) {
  return (
    <nav
      className="flex-shrink-0 flex flex-col items-center"
      style={{
        width: 84,
        position: 'relative',
        zIndex: 30,
        background: 'var(--header-bg)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderLeft: CARD_BORDER,
        paddingTop: '1.5rem',
        paddingBottom: '1.5rem',
        gap: 4,
      }}
    >
      {BOTTOM_NAV_ITEMS.map(item => {
        const active = activeTab === item.id;
        const isCenter = item.id === 'brand';
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-2xl"
            style={{ width: 64, flexShrink: 0 }}
          >
            {isCenter ? (
              <span
                className="flex items-center justify-center rounded-full flex-shrink-0"
                style={{
                  width: 44,
                  height: 44,
                  background: 'var(--card-bg, #fff)',
                  border: CARD_BORDER,
                  boxShadow: '0 4px 10px rgba(0,0,0,0.14)',
                }}
              >
                <BottomNavLogo active={active} theme={theme} size={22} />
              </span>
            ) : (
              <Icon size={20} style={{ color: active ? ACCENT : INK_SOFT, transition: 'color 150ms ease' }} strokeWidth={active ? 2.4 : 2} />
            )}
            <span
              className="text-[10px] truncate"
              style={{
                color: active ? ACCENT : INK_SOFT,
                fontWeight: active ? 700 : 500,
                maxWidth: '100%',
              }}
            >
              {isCenter ? '' : t[item.labelKey]}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
