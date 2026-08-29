import { useState } from 'react';
import { Calendar, Globe, Images, User } from 'lucide-react';
import { ACCENT, CARD_BORDER, INK_SOFT } from '../../constants/colors.js';

// 中央 Logo：深色模式 / 淺色模式各一份圖檔，放在 public 目錄下即可自動套用。
export const BOTTOM_NAV_LOGO_SRC_LIGHT = '/nav-logo-light.png';
export const BOTTOM_NAV_LOGO_SRC_DARK = '/nav-logo-dark.png';

// 順序：世界時鐘 → 日程 → 中央 Logo → 相冊 → 我的
export const BOTTOM_NAV_ITEMS = [
  { id: 'clock', icon: Globe, labelKey: 'worldClock' },
  { id: 'schedule', icon: Calendar, labelKey: 'navSchedule' },
  { id: 'brand', icon: null, labelKey: null }, // 中央特殊處理，見下方渲染邏輯
  { id: 'gallery', icon: Images, labelKey: 'navGallery' },
  { id: 'profile', icon: User, labelKey: 'navProfile' },
];

const NAV_BAR_HEIGHT = 64;
const NOTCH_BUTTON_SIZE = 56;
// objectBoundingBox 座標系（0~1），會隨容器實際寬高自動縮放，不需要手動換算 px。
// 形狀：兩側平直，中間用兩段貝茲曲線向下凹，做出「包住」中央按鈕的弧形缺口。
const NOTCH_PATH =
  'M0,0 L0.40,0 C0.455,0 0.455,0.62 0.5,0.62 C0.545,0.62 0.545,0 0.60,0 L1,0 L1,1 L0,1 Z';

function NotchClipDefs() {
  // 只需要在畫面上定義一次即可，多個 nav 實例共用同一個 id 沒關係（SVG clipPath 是全域參照）。
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <clipPath id="bottom-nav-notch" clipPathUnits="objectBoundingBox">
          <path d={NOTCH_PATH} />
        </clipPath>
      </defs>
    </svg>
  );
}

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
  const sideItems = BOTTOM_NAV_ITEMS.filter(item => item.id !== 'brand');
  const centerItem = BOTTOM_NAV_ITEMS.find(item => item.id === 'brand');
  const centerActive = activeTab === centerItem.id;

  return (
    <nav
      className="flex-shrink-0"
      style={{
        position: 'relative',
        zIndex: 30,
        // iOS Safe Area／Android 手勢導覽區：跟 Header 頂部安全區同一套做法（env() 在沒有
        // 安全區概念的環境下是 0，不影響一般網頁版），底部再固定留一點基礎間距。
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <NotchClipDefs />
      <div className="max-w-md mx-auto w-full" style={{ position: 'relative', height: NAV_BAR_HEIGHT }}>
        {/* 背景層：真正被挖出凹陷缺口的是這一層，跟按鈕分開才不會連按鈕本身也被裁掉 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--header-bg)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            borderTop: CARD_BORDER,
            clipPath: 'url(#bottom-nav-notch)',
          }}
        />

        {/* 前景：四個一般分頁項目，中間留一個等寬的空位對齊凹陷 */}
        <div className="relative h-full flex items-center justify-between px-2">
          {sideItems.map((item, i) => {
            const active = activeTab === item.id;
            const Icon = item.icon;
            return (
              <>
                {i === 2 && <span key="spacer" style={{ width: NOTCH_BUTTON_SIZE, flexShrink: 0 }} />}
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className="flex-1 flex flex-col items-center justify-center gap-1"
                  style={{ minWidth: 0 }}
                >
                  <Icon size={20} style={{ color: active ? ACCENT : INK_SOFT, transition: 'color 150ms ease' }} strokeWidth={active ? 2.4 : 2} />
                  <span
                    className="text-[10px] truncate"
                    style={{ color: active ? ACCENT : INK_SOFT, fontWeight: active ? 700 : 500, maxWidth: '100%' }}
                  >
                    {t[item.labelKey]}
                  </span>
                </button>
              </>
            );
          })}
        </div>

        {/* 中央浮動按鈕：獨立絕對定位，不受 clip-path 影響，精準卡在凹陷正中間 */}
        <button
          onClick={() => setActiveTab(centerItem.id)}
          className="flex items-center justify-center rounded-full"
          style={{
            position: 'absolute',
            left: '50%',
            top: -(NOTCH_BUTTON_SIZE - 34),
            transform: 'translateX(-50%)',
            width: NOTCH_BUTTON_SIZE,
            height: NOTCH_BUTTON_SIZE,
            background: 'var(--card-bg, #fff)',
            border: CARD_BORDER,
            boxShadow: '0 6px 16px rgba(0,0,0,0.18)',
          }}
        >
          <BottomNavLogo active={centerActive} theme={theme} size={26} />
        </button>
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
                style={{ width: 44, height: 44, background: 'var(--card-bg, #fff)', border: CARD_BORDER, boxShadow: '0 4px 10px rgba(0,0,0,0.14)' }}
              >
                <BottomNavLogo active={active} theme={theme} size={22} />
              </span>
            ) : (
              <Icon size={20} style={{ color: active ? ACCENT : INK_SOFT, transition: 'color 150ms ease' }} strokeWidth={active ? 2.4 : 2} />
            )}
            <span
              className="text-[10px] truncate"
              style={{ color: active ? ACCENT : INK_SOFT, fontWeight: active ? 700 : 500, maxWidth: '100%' }}
            >
              {isCenter ? '' : t[item.labelKey]}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
