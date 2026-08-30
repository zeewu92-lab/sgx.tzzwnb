import { useEffect, useRef, useState } from 'react';
import { Calendar, Globe, Images, User } from 'lucide-react';
import {
  ACCENT,
  CARD_BORDER,
  INK_SOFT,
} from '../../constants/colors.js';

// 中央 Logo：深色模式 / 淺色模式各一份圖檔，放在 public 目錄下即可自動套用。
export const BOTTOM_NAV_LOGO_SRC_LIGHT =
  '/nav-logo-light.png';

export const BOTTOM_NAV_LOGO_SRC_DARK =
  '/nav-logo-dark.png';

// 順序：世界時鐘 → 日程 → 中央 Logo → 相冊 → 我的
export const BOTTOM_NAV_ITEMS = [
  {
    id: 'clock',
    icon: Globe,
    emoji: '🌏',
    labelKey: 'worldClock',
  },
  {
    id: 'schedule',
    icon: Calendar,
    emoji: '🗓️',
    labelKey: 'navSchedule',
  },
  {
    id: 'home',
    icon: null,
    emoji: null,
    labelKey: null,
  },
  {
    id: 'gallery',
    icon: Images,
    emoji: '🖼️',
    labelKey: 'navGallery',
  },
  {
    id: 'profile',
    icon: User,
    emoji: '🧚',
    labelKey: 'navProfile',
  },
];

const NAV_BAR_HEIGHT = 64;

// 中央 Logo
const NOTCH_BUTTON_SIZE = 64;

// 中央空間
const NOTCH_SPACE = 88;

// 凹槽位置
const NOTCH_LEFT = 0.395;
const NOTCH_RIGHT = 0.605;

// 凹槽深度
const NOTCH_DEPTH = 0.58;

const NOTCH_PATH = `
  M0,0
  L${NOTCH_LEFT},0
  C0.44,0 0.44,${NOTCH_DEPTH} 0.5,${NOTCH_DEPTH}
  C0.56,${NOTCH_DEPTH} 0.56,0 ${NOTCH_RIGHT},0
  L1,0
  L1,1
  L0,1
  Z
`;

function NotchClipDefs() {
  return (
    <svg
      width="0"
      height="0"
      style={{
        position: 'absolute',
        overflow: 'hidden',
      }}
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

// 凹槽邊界
function NotchBorder() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 64"
      preserveAspectRatio="none"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: NAV_BAR_HEIGHT,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      <path
        d={`
          M0,0
          H${NOTCH_LEFT * 100}
          C44,0 44,${NOTCH_DEPTH * 64} 50,${NOTCH_DEPTH * 64}
          C56,${NOTCH_DEPTH * 64} 56,0 ${NOTCH_RIGHT * 100},0
          H100
        `}
        fill="none"
        stroke="var(--card-border)"
        strokeWidth="0.65"
        vectorEffect="non-scaling-stroke"
        opacity="0.72"
      />
    </svg>
  );
}

// 中央 Logo
export function BottomNavLogo({
  active,
  theme = 'light',
  size = 26,
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [playAnimation, setPlayAnimation] = useState(false);

  const previousActive = useRef(active);
  const animationTimer = useRef(null);

  const src =
    theme === 'dark'
      ? BOTTOM_NAV_LOGO_SRC_DARK
      : BOTTOM_NAV_LOGO_SRC_LIGHT;

  /*
   * 每次由「未選中 → 選中」時重新播放一次動畫。
   */
  useEffect(() => {
    const becameActive =
      !previousActive.current && active;

    previousActive.current = active;

    if (!becameActive) {
      return;
    }

    setPlayAnimation(false);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setPlayAnimation(true);
      });
    });

    if (animationTimer.current) {
      clearTimeout(animationTimer.current);
    }

    animationTimer.current =
      setTimeout(() => {
        setPlayAnimation(false);
      }, 360);

    return () => {
      if (animationTimer.current) {
        clearTimeout(animationTimer.current);
      }
    };
  }, [active]);

  /*
   * 元件卸載時清理 timer。
   */
  useEffect(() => {
    return () => {
      if (animationTimer.current) {
        clearTimeout(animationTimer.current);
      }
    };
  }, []);

  if (imgFailed) {
    return (
      <div
        aria-hidden="true"
        className="rounded-full flex-shrink-0"
        style={{
          width: size,
          height: size,

          background:
            active
              ? ACCENT
              : 'var(--card-border)',

          opacity:
            active ? 1 : 0.55,

          transform:
            active
              ? playAnimation
                ? 'scale(1.16)'
                : 'scale(1.08)'
              : 'scale(1)',

          boxShadow:
            active
              ? playAnimation
                ? '0 0 18px var(--accent-alpha)'
                : '0 0 9px var(--accent-alpha)'
              : 'none',

          transition:
            'transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 320ms ease, opacity 180ms ease',
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

        opacity:
          active ? 1 : 0.72,

        /*
         * 「時光線」動畫：
         *
         * 未選中：
         * 1.00
         *
         * 點擊選中：
         * 1.00 → 1.16
         *
         * 動畫完成：
         * 1.16 → 1.08
         *
         * 最終保持 1.08。
         */
        transform:
          active
            ? playAnimation
              ? 'scale(1.16)'
              : 'scale(1.08)'
            : 'scale(1)',

        /*
         * 線條 Logo 的 Accent 微光。
         *
         * 動畫期間光暈更強，
         * 完成後留下非常淡的光。
         */
        filter:
          active
            ? playAnimation
              ? 'drop-shadow(0 0 3px var(--accent-alpha)) drop-shadow(0 0 10px var(--accent-alpha))'
              : 'drop-shadow(0 0 3px var(--accent-alpha)) drop-shadow(0 0 6px var(--accent-alpha))'
            : 'none',

        transition:
          'opacity 180ms ease, transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1), filter 320ms ease',
      }}
    />
  );
}

// 底部導覽列單項
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
      aria-current={
        active ? 'page' : undefined
      }
      className="flex-1 flex flex-col items-center justify-center"
      style={{
        minWidth: 0,
        height: '100%',
        padding: '5px 2px 4px',
        gap: 2,
        borderRadius: 14,

        background: 'transparent',

        WebkitTapHighlightColor:
          'transparent',

        transition:
          'transform 100ms ease',
      }}
      onPointerDown={event => {
        event.currentTarget.style.transform =
          'scale(0.95)';
      }}
      onPointerUp={event => {
        event.currentTarget.style.transform =
          'scale(1)';
      }}
      onPointerCancel={event => {
        event.currentTarget.style.transform =
          'scale(1)';
      }}
      onPointerLeave={event => {
        event.currentTarget.style.transform =
          'scale(1)';
      }}
    >
      <span
        className="flex items-center justify-center"
        style={{
          width: 34,
          height: 28,
          borderRadius: 10,

          background:
            active
              ? 'color-mix(in srgb, var(--accent-alpha) 45%, transparent)'
              : 'transparent',

          transition:
            'background 180ms ease',
        }}
      >
        {active ? (
          <span
            aria-hidden="true"
            style={{
              fontSize: 21,
              lineHeight: 1,
              display: 'block',

              transform:
                'translateY(-0.5px)',
            }}
          >
            {item.emoji}
          </span>
        ) : (
          <Icon
            size={20}
            style={{
              color: INK_SOFT,

              transition:
                'color 180ms ease',
            }}
            strokeWidth={1.9}
          />
        )}
      </span>

      <span
        className="text-[10px] truncate"
        style={{
          color:
            active
              ? ACCENT
              : INK_SOFT,

          fontWeight:
            active ? 600 : 500,

          lineHeight:
            '14px',

          maxWidth:
            '100%',

          transition:
            'color 180ms ease',
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
  const leftItems =
    BOTTOM_NAV_ITEMS.filter(
      item =>
        item.id === 'clock' ||
        item.id === 'schedule'
    );

  const rightItems =
    BOTTOM_NAV_ITEMS.filter(
      item =>
        item.id === 'gallery' ||
        item.id === 'profile'
    );

  const centerItem =
    BOTTOM_NAV_ITEMS.find(
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

        background:
          'color-mix(in srgb, var(--header-bg) 76%, transparent)',

        backdropFilter:
          'blur(24px) saturate(180%)',

        WebkitBackdropFilter:
          'blur(24px) saturate(180%)',

        boxShadow:
          '0 -0.5px 0 rgba(255,255,255,0.08)',
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
        {/* 玻璃背景 */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,

            background:
              'color-mix(in srgb, var(--header-bg) 76%, transparent)',

            backdropFilter:
              'blur(24px) saturate(180%)',

            WebkitBackdropFilter:
              'blur(24px) saturate(180%)',

            borderTop:
              '0.5px solid var(--card-border)',

            clipPath:
              'url(#bottom-nav-notch)',
          }}
        />

        {/* 極淡的玻璃上緣 */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 1,

            background:
              'rgba(255,255,255,0.08)',

            pointerEvents:
              'none',

            clipPath:
              'url(#bottom-nav-notch)',
          }}
        />

        {/* 凹槽邊界 */}
        <NotchBorder />

        {/* 左右四個頁籤 */}
        <div
          className="relative h-full flex items-stretch"
          style={{
            paddingLeft: 8,
            paddingRight: 8,
          }}
        >
          {/* 左側 */}
          <div
            className="flex-1 flex items-stretch"
            style={{
              minWidth: 0,
            }}
          >
            {leftItems.map(item => (
              <NavItem
                key={item.id}
                item={item}
                active={
                  activeTab === item.id
                }
                onClick={() =>
                  setActiveTab(item.id)
                }
                t={t}
              />
            ))}
          </div>

          {/* 中央空間 */}
          <div
            aria-hidden="true"
            style={{
              width: NOTCH_SPACE,
              flexShrink: 0,
            }}
          />

          {/* 右側 */}
          <div
            className="flex-1 flex items-stretch"
            style={{
              minWidth: 0,
            }}
          >
            {rightItems.map(item => (
              <NavItem
                key={item.id}
                item={item}
                active={
                  activeTab === item.id
                }
                onClick={() =>
                  setActiveTab(item.id)
                }
                t={t}
              />
            ))}
          </div>
        </div>

        {/* 中央浮動 Logo */}
        <button
          type="button"
          onClick={() =>
            setActiveTab(centerItem.id)
          }
          aria-label="時光線"
          aria-current={
            centerActive
              ? 'page'
              : undefined
          }
          className="flex items-center justify-center rounded-full"
          style={{
            position: 'absolute',
            left: '50%',

            top:
              -(NOTCH_BUTTON_SIZE - 34) + 8,

            transform:
              'translateX(-50%)',

            width:
              NOTCH_BUTTON_SIZE,

            height:
              NOTCH_BUTTON_SIZE,

            padding: 0,

            background:
              'var(--card-bg, #fff)',

            border:
              '0.5px solid var(--card-border)',

            /*
             * 時光線選中時：
             * 柔和陰影 + Accent 外圈。
             */
            boxShadow:
              centerActive
                ? '0 4px 14px rgba(0,0,0,0.14), 0 0 0 3px var(--accent-alpha)'
                : '0 3px 9px rgba(0,0,0,0.10)',

            WebkitTapHighlightColor:
              'transparent',

            transition:
              'box-shadow 300ms ease, transform 100ms ease',
          }}
          onPointerDown={event => {
            event.currentTarget.style.transform =
              'translateX(-50%) scale(0.95)';
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

        background:
          'var(--header-bg)',

        backdropFilter:
          'blur(20px) saturate(180%)',

        WebkitBackdropFilter:
          'blur(20px) saturate(180%)',

        borderLeft:
          CARD_BORDER,

        paddingTop:
          '1.5rem',

        paddingBottom:
          '1.5rem',

        gap: 4,
      }}
    >
      {BOTTOM_NAV_ITEMS.map(item => {
        const active =
          activeTab === item.id;

        const isCenter =
          item.id === 'home';

        const Icon =
          item.icon;

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
              active
                ? 'page'
                : undefined
            }
            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-2xl"
            style={{
              width: 64,
              minHeight: 58,
              flexShrink: 0,

              background:
                active && !isCenter
                  ? 'color-mix(in srgb, var(--accent-alpha) 45%, transparent)'
                  : 'transparent',

              WebkitTapHighlightColor:
                'transparent',

              transition:
                'background 180ms ease, transform 100ms ease',
            }}
            onPointerDown={event => {
              event.currentTarget.style.transform =
                'scale(0.95)';
            }}
            onPointerUp={event => {
              event.currentTarget.style.transform =
                'scale(1)';
            }}
            onPointerCancel={event => {
              event.currentTarget.style.transform =
                'scale(1)';
            }}
            onPointerLeave={event => {
              event.currentTarget.style.transform =
                'scale(1)';
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

                  border:
                    '0.5px solid var(--card-border)',

                  boxShadow:
                    active
                      ? '0 4px 12px rgba(0,0,0,0.14), 0 0 0 3px var(--accent-alpha)'
                      : '0 3px 9px rgba(0,0,0,0.10)',

                  transition:
                    'box-shadow 300ms ease',
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
                  width: 34,
                  height: 28,
                  borderRadius: 10,

                  background:
                    active
                      ? 'color-mix(in srgb, var(--accent-alpha) 45%, transparent)'
                      : 'transparent',

                  transition:
                    'background 180ms ease',
                }}
              >
                {active ? (
                  <span
                    aria-hidden="true"
                    style={{
                      fontSize: 21,
                      lineHeight: 1,
                      display: 'block',

                      transform:
                        'translateY(-0.5px)',
                    }}
                  >
                    {item.emoji}
                  </span>
                ) : (
                  <Icon
                    size={20}
                    style={{
                      color: INK_SOFT,

                      transition:
                        'color 180ms ease',
                    }}
                    strokeWidth={1.9}
                  />
                )}
              </span>
            )}

            <span
              className="text-[10px] truncate"
              style={{
                color:
                  active
                    ? ACCENT
                    : INK_SOFT,

                fontWeight:
                  active ? 600 : 500,

                maxWidth:
                  '100%',

                lineHeight:
                  '14px',
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
