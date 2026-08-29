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
  { id: 'home', icon: null, labelKey: null },
  { id: 'gallery', icon: Images, labelKey: 'navGallery' },
  { id: 'profile', icon: User, labelKey: 'navProfile' },
];

const NAV_BAR_HEIGHT = 64;
const NOTCH_BUTTON_SIZE = 64;

// 中央按鈕凹槽。
// 使用 objectBoundingBox，會依導覽列實際寬度自動縮放。
const NOTCH_PATH =
  'M0,0 L0.40,0 C0.455,0 0.455,0.62 0.5,0.62 C0.545,0.62 0.545,0 0.60,0 L1,0 L1,1 L0,1 Z';

function NotchClipDefs() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: 'absolute' }}
      aria-hidden="true"
    >
      <defs>
        <clipPath
          id="bottom-nav-notch"
          clipPathUnits="objectBoundingBox"
        >
          <path d={NOTCH_PATH} />
        </clipPath>
      </defs>
    </svg>
  );
}

export function BottomNavLogo({
  active,
  theme = 'light',
  size = 26,
}) {
  const [imgFailed, setImgFailed] = useState(false);

  const src =
    theme === 'dark'
      ? BOTTOM_NAV_LOGO_SRC_DARK
      : BOTTOM_NAV_LOGO_SRC_LIGHT;

  if (imgFailed) {
    return (
      <div
        aria-hidden="true"
        className="rounded-full flex-shrink-0"
        style={{
          width: size,
          height: size,
          background: active
            ? ACCENT
            : 'var(--card-border)',
          opacity: active ? 1 : 0.7,
          transition:
            'background 150ms ease, opacity 150ms ease',
        }}
      />
    );
  }

  return (
    <img
      key={src}
      src={src}
      alt=""
      aria-hidden="true"
      onError={() => setImgFailed(true)}
      className="flex-shrink-0"
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        opacity: active ? 1 : 0.78,
        transform: active ? 'scale(1.04)' : 'scale(1)',
        transition:
          'opacity 150ms ease, transform 150ms ease',
      }}
    />
  );
}

function NavItem({
  item,
  active,
  onClick,
  t,
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t[item.labelKey]}
      aria-current={active ? 'page' : undefined}
      className="flex-1 flex flex-col items-center justify-center"
      style={{
        minWidth: 0,
        height: '100%',
        padding: '5px 2px 4px',
        gap: 2,
        borderRadius: 14,
        background: 'transparent',
        WebkitTapHighlightColor: 'transparent',
        transition: 'transform 100ms ease',
      }}
      onPointerDown={event => {
        event.currentTarget.style.transform = 'scale(0.94)';
      }}
      onPointerUp={event => {
        event.currentTarget.style.transform = 'scale(1)';
      }}
      onPointerCancel={event => {
        event.currentTarget.style.transform = 'scale(1)';
      }}
      onPointerLeave={event => {
        event.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <span
        className="flex items-center justify-center"
        style={{
          width: 32,
          height: 28,
          borderRadius: 10,
          background: active
            ? 'var(--accent-alpha)'
            : 'transparent',
          transition:
            'background 150ms ease',
        }}
      >
        <Icon
          size={20}
          style={{
            color: active ? ACCENT : INK_SOFT,
            transition: 'color 150ms ease',
          }}
          strokeWidth={active ? 2.4 : 2}
        />
      </span>

      <span
        className="text-[10px] truncate"
        style={{
          color: active ? ACCENT : INK_SOFT,
          fontWeight: active ? 700 : 500,
          lineHeight: '14px',
          maxWidth: '100%',
          transition:
            'color 150ms ease, font-weight 150ms ease',
        }}
      >
        {t[item.labelKey]}
      </span>
    </button>
  );
}

export function BottomNavigation({
  activeTab,
  setActiveTab,
  t,
  theme = 'light',
}) {
  const sideItems = BOTTOM_NAV_ITEMS.filter(
    item => item.id !== 'home'
  );

  const centerItem = BOTTOM_NAV_ITEMS.find(
    item => item.id === 'home'
  );

  const centerActive =
    activeTab === centerItem.id;

  return (
    <nav
      aria-label="主要導覽"
      className="flex-shrink-0"
      style={{
        position: 'relative',
        zIndex: 30,
        paddingBottom:
          'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <NotchClipDefs />

      <div
        className="max-w-md mx-auto w-full"
        style={{
          position: 'relative',
          height: NAV_BAR_HEIGHT,
        }}
      >
        {/* 導覽列背景與中央凹槽 */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--header-bg)',
            backdropFilter:
              'blur(20px) saturate(180%)',
            WebkitBackdropFilter:
              'blur(20px) saturate(180%)',
            borderTop: CARD_BORDER,
            clipPath:
              'url(#bottom-nav-notch)',
          }}
        />

        {/* 四個一般導覽項目 */}
        <div
          className="relative h-full flex items-center justify-between px-2"
        >
          {sideItems.map((item, index) => (
            <NavItem
              key={item.id}
              item={item}
              active={activeTab === item.id}
              onClick={() =>
                setActiveTab(item.id)
              }
              t={t}
            />
          ))}

          {/* 中央空位，確保左右四項始終對稱 */}
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '50%',
              top: 0,
              width: NOTCH_BUTTON_SIZE,
              height: '100%',
              transform:
                'translateX(-50%)',
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* 中央浮動「時光線」按鈕 */}
        <button
          type="button"
          onClick={() =>
            setActiveTab(centerItem.id)
          }
          aria-label="時光線"
          aria-current={
            centerActive ? 'page' : undefined
          }
          className="flex items-center justify-center rounded-full"
          style={{
            position: 'absolute',
            left: '50%',
            top: -(NOTCH_BUTTON_SIZE - 34),
            transform:
              'translateX(-50%)',
            width: NOTCH_BUTTON_SIZE,
            height: NOTCH_BUTTON_SIZE,
            padding: 0,
            background:
              'var(--card-bg, #fff)',
            border: CARD_BORDER,
            boxShadow:
              centerActive
                ? '0 7px 18px rgba(0,0,0,0.22)'
                : '0 5px 14px rgba(0,0,0,0.16)',
            WebkitTapHighlightColor:
              'transparent',
            transition:
              'box-shadow 150ms ease, transform 100ms ease',
          }}
          onPointerDown={event => {
            event.currentTarget.style.transform =
              'translateX(-50%) scale(0.94)';
          }}
          onPointerUp={event => {
            event.currentTarget.style.transform =
              'translateX(-50%) scale(1)';
          }}
          onPointerCancel={event => {
            event.currentTarget.style.transform =
              'translateX(-50%) scale(1)';
          }}
          onPointerLeave={event => {
            event.currentTarget.style.transform =
              'translateX(-50%) scale(1)';
          }}
        >
          <BottomNavLogo
            active={centerActive}
            theme={theme}
            size={32}
          />
        </button>
      </div>
    </nav>
  );
}

export function SideNavigation({
  activeTab,
  setActiveTab,
  t,
  theme = 'light',
}) {
  return (
    <nav
      aria-label="主要導覽"
      className="flex-shrink-0 flex flex-col items-center"
      style={{
        width: 84,
        position: 'relative',
        zIndex: 30,
        background: 'var(--header-bg)',
        backdropFilter:
          'blur(20px) saturate(180%)',
        WebkitBackdropFilter:
          'blur(20px) saturate(180%)',
        borderLeft: CARD_BORDER,
        paddingTop: '1.5rem',
        paddingBottom: '1.5rem',
        gap: 4,
      }}
    >
      {BOTTOM_NAV_ITEMS.map(item => {
        const active =
          activeTab === item.id;
        const isCenter =
          item.id === 'home';
        const Icon = item.icon;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() =>
              setActiveTab(item.id)
            }
            aria-label={
              isCenter
                ? '時光線'
                : t[item.labelKey]
            }
            aria-current={
              active ? 'page' : undefined
            }
            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-2xl"
            style={{
              width: 64,
              minHeight: 58,
              flexShrink: 0,
              background:
                active && !isCenter
                  ? 'var(--accent-alpha)'
                  : 'transparent',
              WebkitTapHighlightColor:
                'transparent',
              transition:
                'background 150ms ease, transform 100ms ease',
            }}
          >
            {isCenter ? (
              <span
                className="flex items-center justify-center rounded-full flex-shrink-0"
                style={{
                  width: 52,
                  height: 52,
                  background:
                    'var(--card-bg, #fff)',
                  border: CARD_BORDER,
                  boxShadow:
                    active
                      ? '0 5px 13px rgba(0,0,0,0.18)'
                      : '0 4px 10px rgba(0,0,0,0.14)',
                  transition:
                    'box-shadow 150ms ease',
                }}
              >
                <BottomNavLogo
                  active={active}
                  theme={theme}
                  size={26}
                />
              </span>
            ) : (
              <span
                className="flex items-center justify-center"
                style={{
                  width: 32,
                  height: 28,
                  borderRadius: 10,
                  background:
                    active
                      ? 'var(--accent-alpha)'
                      : 'transparent',
                  transition:
                    'background 150ms ease',
                }}
              >
                <Icon
                  size={20}
                  style={{
                    color: active
                      ? ACCENT
                      : INK_SOFT,
                    transition:
                      'color 150ms ease',
                  }}
                  strokeWidth={
                    active ? 2.4 : 2
                  }
                />
              </span>
            )}

            <span
              className="text-[10px] truncate"
              style={{
                color: active
                  ? ACCENT
                  : INK_SOFT,
                fontWeight:
                  active ? 700 : 500,
                maxWidth: '100%',
                lineHeight: '14px',
              }}
            >
              {isCenter
                ? ''
                : t[item.labelKey]}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
