import { useState } from 'react';
import { Globe, User, Images, Calendar } from 'lucide-react';
import { ACCENT, CARD_BORDER, INK_SOFT } from '../../constants/colors.js';

export const BOTTOM_NAV_LOGO_SRC = '/nav-logo.png';

export const BOTTOM_NAV_ITEMS = [
  { id: 'clock', icon: Globe, labelKey: 'worldClock' },
  { id: 'schedule', icon: Calendar, labelKey: 'navSchedule' },
  { id: 'home', icon: null, labelKey: null }, // 中央特殊處理，見下方渲染邏輯
  { id: 'gallery', icon: Images, labelKey: 'navGallery' },
  { id: 'profile', icon: User, labelKey: 'navProfile' },
];

export function BottomNavLogo({ active }) {
  // 品牌圖示素材還沒放上去之前，用一個中性的實心圓點佔位（不是刻意畫的替代 Logo），
  // 圖片載入失敗時自動切換回這個佔位，素材一到位就會自動顯示正式圖檔。
  const [imgFailed, setImgFailed] = useState(false);
  if (imgFailed) {
    return (
      <div
        className="rounded-full flex-shrink-0"
        style={{ width: 22, height: 22, background: active ? ACCENT : 'var(--card-border)', transition: 'background 150ms ease' }}
      />
    );
  }
  return (
    <img
      src={BOTTOM_NAV_LOGO_SRC}
      alt=""
      onError={() => setImgFailed(true)}
      className="flex-shrink-0"
      style={{ width: 24, height: 24, objectFit: 'contain', opacity: active ? 1 : 0.55, transition: 'opacity 150ms ease' }}
    />
  );
}

export function BottomNavigation({ activeTab, setActiveTab, t }) {
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
      <div className="max-w-md mx-auto w-full flex items-stretch justify-between px-2">
        {BOTTOM_NAV_ITEMS.map(item => {
          const active = activeTab === item.id;
          const isCenter = item.id === 'home';
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2"
              style={{ minWidth: 0 }}
            >
              {isCenter ? (
                <BottomNavLogo active={active} />
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
                {isCenter ? '時光線' : t[item.labelKey]}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function SideNavigation({ activeTab, setActiveTab, t }) {
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
        const isCenter = item.id === 'home';
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-2xl"
            style={{ width: 64, flexShrink: 0 }}
          >
            {isCenter ? (
              <BottomNavLogo active={active} />
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
              {isCenter ? '時光線' : t[item.labelKey]}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
