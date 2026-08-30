import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, ChevronRight, X, Clock, Moon, Sun, Sunrise, Sunset } from 'lucide-react';
import { AnalogClock, ClockRow } from './ClockCard.jsx';
import { ACCENT, AUTH_GLASS, CARD_BG, CARD_BORDER, DANGER, INK, INK_SOFT, glass } from '../../constants/colors.js';
import { LOCALE_MAP } from '../../constants/languages.js';
import { CITIES } from '../../constants/worldCities.js';
import { useModalBackClose } from '../../hooks/useModalBackClose.js';
import { openDropdownExclusive, useExclusiveDropdown } from '../../hooks/useOverlayTransition.js';
import { formatSunTime, getOffsetMinutes, getSunTimes, getUtcOffset } from '../../utils/timezone.js';

export function CurrentLocationClockModal({ clock, now, restClocks, lang, t, onClose, dock = false, closing = false }) {
  const city = CITIES.find(c => c.tz === clock.tz);
  const nameLabel = city ? city.name[lang] : clock.tz;
  const timeStr = new Intl.DateTimeFormat(LOCALE_MAP[lang], { timeZone: clock.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
  const offsetStr = getUtcOffset(clock.tz, now);

  // 呼出／關閉動畫：'enter' 是剛掛載、尚未套用「顯示中」樣式的那一幀，下一個 rAF
  // 立刻切到 'shown' 觸發 CSS transition 由小變大、淡入；使用者關閉時先切到 'closing'
  // 讓 transition 反向播放，等動畫播完（與 CLOSE_DURATION 對齊）才真的呼叫 onClose 卸載，
  // 而不是直接把整個視窗從畫面上瞬間移除。
  const [phase, setPhase] = useState('enter');
  const CLOSE_DURATION = 60;
  useEffect(() => {
    const id = requestAnimationFrame(() => setPhase('shown'));
    return () => cancelAnimationFrame(id);
  }, []);
  // dock 模式下，App 那層要換成別的卡片時，會透過這個外部的 closing 訊號告訴這裡「該播放關閉動畫了」，
  // 跟使用者自己按 X／點背景關閉的差別是：這裡只負責把「正在關閉」的視覺效果播出來，不會自己呼叫
  // onClose 去卸載自己——真正的內容替換（卸載這張、換上新的一張）時機由 App 那層統一控制，
  // 兩邊動畫接起來才會有「自動關閉舊卡片、彈出新卡片」的絲滑感，而不是內容瞬間跳掉
  useEffect(() => {
    if (closing) setPhase('closing');
  }, [closing]);
  function handleClose() {
    setPhase('closing');
    setTimeout(onClose, CLOSE_DURATION);
  }
  // dock 模式是常駐在頁面上的內容，不是彈窗，不該劫持返回鍵——不然按返回鍵只會讓這塊內容
  // 自己播一次「關閉動畫」卻沒有東西真的關掉（onClose 在 dock 模式下通常是空函式），
  // 使用者會覺得畫面卡住。只有真正的彈窗模式才需要返回鍵＝關閉這個行為。
  useModalBackClose(!dock, handleClose);
  const shown = phase === 'shown';

  return (
    <div
      className={dock ? 'relative h-full w-full' : 'fixed inset-0 flex items-center justify-center px-6'}
      style={dock ? undefined : {
        zIndex: 200,
        background: shown ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
        transition: `background ${CLOSE_DURATION}ms ease`,
      }}
      onClick={dock ? undefined : handleClose}
    >
      <div
        className={dock ? 'w-full h-full overflow-y-auto rounded-3xl p-5 flex flex-col items-center' : 'w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-3xl p-5 flex flex-col items-center'}
        style={{
          ...AUTH_GLASS,
          opacity: shown ? 1 : 0,
          // dock（分欄右側面板）模式下改成從右邊帶點彈性地「彈射」滑入，
          // 呼應它在大屏分欄版面裡本來就位於右側的方位；非 dock（手機置中彈窗）維持原本由下往上彈出的效果
          transform: shown
            ? 'scale(1) translateX(0px) translateY(0px)'
            : dock ? 'scale(0.94) translateX(28px) translateY(0px)' : 'scale(0.92) translateX(0px) translateY(14px)',
          transition: `opacity ${CLOSE_DURATION}ms ease, transform ${CLOSE_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-full flex items-center justify-between mb-1">
          <span className="flex items-center gap-1.5 text-sm font-bold" style={{ color: ACCENT }}>
            📍{t.currentLocation}
          </span>
          {/* dock 模式＝常駐在頁面上的內容，不是可以關掉的彈窗，這裡就不需要叉叉關閉按鈕了 */}
          {!dock && (
            <button onClick={handleClose} aria-label={t.close} style={{ color: INK_SOFT }}><X size={18} /></button>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1">
          <span className="font-bold text-lg" style={{ color: INK }}>{nameLabel}</span>
        </div>

        {/* 時鐘本體：比一般置中位置再往下推一點 */}
        <div className="mt-6">
          <AnalogClock tz={clock.tz} now={now} size={220} />
        </div>

        <div className="flex flex-col items-center mt-4 mb-5">
          <span className="font-bold tabular-nums" style={{ fontFamily: "'Quicksand', sans-serif", fontSize: 22, color: INK }}>{timeStr}</span>
          <span className="text-xs mt-0.5" style={{ color: INK_SOFT }}>{offsetStr}</span>
        </div>

        {/* 其他已加入的時區列表（唯讀） */}
        <div className="w-full flex flex-col gap-2">
          {restClocks.map(c => {
            const rc = CITIES.find(x => x.tz === c.tz);
            const rName = rc ? rc.name[lang] : c.tz;
            const rSubLabel = rc ? rc.country[lang] : null;
            const rTimeStr = new Intl.DateTimeFormat(LOCALE_MAP[lang], { timeZone: c.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
            const rOffsetStr = getUtcOffset(c.tz, now);
            return (
              <div key={c.id} className="w-full flex items-center justify-between px-4 py-3 rounded-2xl" style={{ background: CARD_BG, border: CARD_BORDER }}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex flex-col items-start min-w-0">
                    <span className="font-bold text-sm truncate" style={{ color: INK }}>{rName}</span>
                    {rSubLabel && <span className="text-xs truncate" style={{ color: INK_SOFT }}>{rSubLabel}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end flex-shrink-0 pl-3">
                  <span className="font-bold tabular-nums whitespace-nowrap" style={{ fontFamily: "'Quicksand', sans-serif", fontSize: 16, color: INK }}>{rTimeStr}</span>
                  <span className="text-xs whitespace-nowrap" style={{ color: INK_SOFT }}>{rOffsetStr}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function WorldClockSection({ clocks, setClocks, lang, t, onHomeTzChange, homeTzId, setHomeTzId, part2Ref, part2Height, isDraggingWorldClock, isLargeScreen = false, unlimitedHeight = false, fullPage = false }) {
  const [now, setNow] = useState(new Date());
  const [showMenu, setShowMenu] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState([]);
  // fullPage（獨立「世界時鐘」分頁）版面專用：目前開啟哪一筆時鐘的詳細頁（存 id，null＝沒開）
  const [detailClockId, setDetailClockId] = useState(null);
  // 雙欄不再由使用者手動切換，改成加入的時區數量達到 3 個（含）以上時自動切成雙欄，方便一次看到更多時區
  const columns = clocks.length >= 3 ? 2 : 1;
  // 「目前位置」設定的是哪一筆時鐘（id）：改由上層 App 提供／持久化（見 HOME_TZ_ID_KEY），
  // 這個元件重新掛載（例如整頁重新整理）後才不會回復成沒設定的原狀
  //
  // 「目前位置時鐘詳情」（原本雙擊 hero 卡片才會跳出的視窗）已經不再由這個元件負責開關，
  // 那個視窗的內容現在直接常駐顯示在「世界時鐘」分頁本身（見 App() 裡 activeTab === 'clock'
  // 那段，用 CurrentLocationClockModal 的 dock 模式渲染），這裡不用再持有任何開關狀態。
  const menuRef = useRef(null);

  useEffect(() => { const iv = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(iv); }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useExclusiveDropdown('timezone', showMenu, () => setShowMenu(false));

  const addedTz = new Set(clocks.map(c => c.tz));
  const homeClock = clocks.find(c => c.id === homeTzId) || null;

  // 將「目前位置」的時區回報給上層 App，讓頂部標題列能依此判斷早上好／中午好／晚上好
  useEffect(() => { onHomeTzChange && onHomeTzChange(homeClock ? homeClock.tz : null); }, [homeClock, onHomeTzChange]);

  function addZone(city) {
    setClocks(prev => [...prev, { id: Date.now().toString(), tz: city.tz }]);
    setShowMenu(false);
  }
  function longPress(id) { setSelectMode(true); setSelected(prev => (prev.includes(id) ? prev : [...prev, id])); }
  function tap(id) {
    if (selectMode) {
      setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
      return;
    }
    // 單獨點一下：設為目前位置，再點一下取消
    setHomeTzId(prev => (prev === id ? null : id));
  }
  function confirmDelete() {
    setClocks(prev => prev.filter(c => !selected.includes(c.id)));
    if (selected.includes(homeTzId)) setHomeTzId(null);
    setSelectMode(false);
    setSelected([]);
  }
  function cancelSelect() { setSelectMode(false); setSelected([]); }

  const cityOptions = CITIES.filter(c => !addedTz.has(c.tz));

  // Part 2 只顯示「非目前位置」的時區；目前位置改成在 Part 1 置頂區塊常駐顯示
  const restClocks = clocks.filter(c => c.id !== homeTzId);

  // ============================================================
  // fullPage：獨立「世界時鐘」分頁的極簡版面（時光線首頁內嵌的樣式維持在下面完全不動）。
  // 設計原則：中性色為主，只有「現在」那個點用品牌色；不用國旗、不用地球插畫、不用卡片外框，
  // 城市清單改成一行一列＋分隔線。詳見設計方案文件。
  // ============================================================
  if (fullPage) {
    const periodInfo = (hour) => {
      if (hour >= 5 && hour < 9) return { label: t.periodDawn, Icon: Sunrise };
      if (hour >= 9 && hour < 18) return { label: t.periodDay, Icon: Sun };
      return { label: t.periodNight, Icon: Moon };
    };

    const diffFromHomeLabel = (clockTz) => {
      if (!homeClock || clockTz === homeClock.tz) return null;
      const diffMinutes = getOffsetMinutes(clockTz, now) - getOffsetMinutes(homeClock.tz, now);
      if (diffMinutes === 0) return t.sameAsCurrent;
      const abs = Math.abs(diffMinutes);
      const h = Math.floor(abs / 60);
      const mm = abs % 60;
      const hourStr = `${h}${mm ? `:${String(mm).padStart(2, '0')}` : ''}`;
      const homeName = (CITIES.find(c => c.tz === homeClock.tz) || {}).name || {};
      const homeLabel = homeName[lang] || homeClock.tz;
      return diffMinutes > 0 ? t.fasterThanHome(homeLabel, hourStr) : t.slowerThanHome(homeLabel, hourStr);
    };

    const homeHourFraction = homeClock
      ? (() => {
          const p = new Intl.DateTimeFormat('en-US', { timeZone: homeClock.tz, hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(now);
          const o = {}; p.forEach(x => { if (x.type !== 'literal') o[x.type] = parseInt(x.value, 10); });
          return ((o.hour % 24) + o.minute / 60) / 24;
        })()
      : null;

    const detailClock = detailClockId ? clocks.find(c => c.id === detailClockId) : null;

    function cityLabel(clock) {
      const city = CITIES.find(c => c.tz === clock.tz);
      const name = city ? city.name[lang] : clock.tz;
      const secondLine = city ? city.country[lang] : null;
      return { name, secondLine };
    }

    function timeStrOf(tz) {
      return new Intl.DateTimeFormat(LOCALE_MAP[lang], { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
    }

    return (
      <div className="w-full flex flex-col">
        {/* 標題列：只留一個「＋新增城市」，其餘（更多／搜尋／設定／排序）第一版先不放 */}
        <div className="flex items-center justify-end pt-1 pb-2">
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(v => { const next = !v; if (next) openDropdownExclusive('timezone'); return next; })}
              aria-label={t.addTimezone}
              className="flex items-center justify-center rounded-full"
              style={{ width: 32, height: 32, color: ACCENT }}
            >
              <Plus size={22} />
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-2 rounded-xl overflow-y-auto z-10" style={{ ...glass(), width: 220, maxHeight: 280, boxShadow: '0 10px 30px rgba(35,39,51,0.15)' }}>
                {cityOptions.length === 0 ? (
                  <div className="px-3 py-3 text-sm" style={{ color: INK_SOFT }}>{t.allAdded}</div>
                ) : (
                  cityOptions.map(c => (
                    <button key={c.id} onClick={() => addZone(c)}
                      className="w-full text-left px-3 py-2 text-sm"
                      style={{ color: INK }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--card-border)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      {c.name[lang]}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* 焦點區：目前位置的大字時間，縮小一些不佔滿整頁 */}
        {homeClock ? (
          <div className="flex flex-col items-center text-center pt-1 pb-6">
            <span className="font-bold tabular-nums leading-none" style={{ fontFamily: "'Quicksand', sans-serif", fontSize: 52, color: INK }}>
              {timeStrOf(homeClock.tz)}
            </span>
            <span className="font-medium mt-1.5" style={{ fontSize: 18, color: INK }}>
              {cityLabel(homeClock).name}
            </span>
            <span className="mt-0.5" style={{ fontSize: 13, color: INK_SOFT }}>
              {new Intl.DateTimeFormat(LOCALE_MAP[lang], { timeZone: homeClock.tz, month: 'long', day: 'numeric', weekday: 'short' }).format(now)}
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center pt-1 pb-6">
            <p className="text-sm px-6 text-center" style={{ color: INK_SOFT }}>{t.emptyClocks}</p>
          </div>
        )}

        {/* 全球時間軸：一條很細的刻度線，只用「現在」這個點用品牌色標出目前位置的時刻 */}
        {homeClock && (
          <div className="px-1 pb-7">
            <div className="flex items-center justify-between mb-1.5" style={{ fontSize: 11, color: INK_SOFT }}>
              <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
            </div>
            <div className="relative" style={{ height: 22 }}>
              <div
                className="absolute left-0 right-0 rounded-full"
                style={{
                  top: 9, height: 3,
                  background: 'linear-gradient(90deg, var(--card-border) 0%, var(--card-border) 18%, rgba(200,160,90,0.35) 27%, rgba(200,160,90,0.15) 42%, var(--card-border) 52%, rgba(200,160,90,0.15) 58%, rgba(200,160,90,0.35) 73%, var(--card-border) 82%, var(--card-border) 100%)',
                }}
              />
              <div
                className="absolute rounded-full"
                style={{ left: `calc(${homeHourFraction * 100}% - 4px)`, top: 6, width: 9, height: 9, background: ACCENT, boxShadow: `0 0 0 3px ${ACCENT}22` }}
              />
              <span
                className="absolute font-medium whitespace-nowrap"
                style={{ left: `${homeHourFraction * 100}%`, transform: 'translateX(-50%)', top: 15, fontSize: 10, color: ACCENT }}
              >
                {t.nowLabel}
              </span>
            </div>
          </div>
        )}

        {/* 已加入城市：一行一列，不用卡片、不用國旗，點一列開啟該城市的詳細頁 */}
        <div className="flex-1 min-h-0 overflow-y-auto pb-8">
          {restClocks.length > 0 && (
            <p className="px-1 pb-2 font-medium" style={{ fontSize: 13, color: INK_SOFT }}>{t.addedCities}</p>
          )}
          <div className="flex flex-col">
            {restClocks.map((c, idx) => {
              const { name, secondLine } = cityLabel(c);
              return (
                <button
                  key={c.id}
                  onClick={() => setDetailClockId(c.id)}
                  className="w-full flex items-center justify-between text-left py-3 px-1"
                  style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--card-border)' }}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate" style={{ fontSize: 15, color: INK }}>{name}</span>
                    {secondLine && <span className="truncate" style={{ fontSize: 12, color: INK_SOFT }}>{secondLine}</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 pl-3">
                    <span className="font-medium tabular-nums" style={{ fontFamily: "'Quicksand', sans-serif", fontSize: 17, color: INK }}>{timeStrOf(c.tz)}</span>
                    <ChevronRight size={16} style={{ color: INK_SOFT }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 城市詳細頁：UTC／時差／日期／日出日落／從世界時鐘移除 */}
        {detailClock && (
          <CityDetailSheet
            clock={detailClock}
            now={now}
            lang={lang}
            t={t}
            isHome={detailClock.id === homeTzId}
            onClose={() => setDetailClockId(null)}
            onSetHome={() => { setHomeTzId(detailClock.id); setDetailClockId(null); }}
            onUnsetHome={() => { setHomeTzId(null); setDetailClockId(null); }}
            onRemove={() => {
              setClocks(prev => prev.filter(x => x.id !== detailClock.id));
              if (detailClock.id === homeTzId) setHomeTzId(null);
              setDetailClockId(null);
            }}
            diffLabel={diffFromHomeLabel(detailClock.tz)}
            periodInfo={periodInfo}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mb-2">
      {/* Part 1：標題列＋控制列＋目前位置卡片。整個 WorldClockSection 現在都位於畫面上方
          不捲動的固定區域，不再需要自己 sticky／量測高度 */}
      <div className="pb-1.5">
        <div className="flex items-center justify-between mb-1.5 pt-1">
          <div className="flex items-center gap-2">
            <Clock size="1.125rem" style={{ color: ACCENT }} />
            <h2 className="font-bold" style={{ color: INK, fontSize: '1.125rem' }}>{t.worldClock}</h2>
          </div>

          {selectMode ? (
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: INK_SOFT }}>{t.selectedCount(selected.length)}</span>
              <button onClick={cancelSelect} className="text-sm px-2 py-1 rounded-lg" style={{ color: INK_SOFT }}>{t.cancel}</button>
              <button onClick={confirmDelete} disabled={selected.length === 0}
                className="flex items-center gap-1 text-sm px-3 py-1 rounded-lg font-medium"
                style={{ background: DANGER, color: '#fff', opacity: selected.length === 0 ? 0.4 : 1 }}>
                <Trash2 size={13} /> {t.delete}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative" ref={menuRef}>
                <button onClick={() => setShowMenu(v => { const next = !v; if (next) openDropdownExclusive('timezone'); return next; })}
                  className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg font-medium" style={{ background: ACCENT, color: '#fff' }}>
                  <Plus size={14} /> {t.addTimezone}
                </button>
              {showMenu && (
                <div className="absolute right-0 mt-2 rounded-xl overflow-y-auto z-10" style={{ ...glass(), width: 220, maxHeight: 280, boxShadow: '0 10px 30px rgba(35,39,51,0.15)' }}>
                  {cityOptions.length === 0 ? (
                    <div className="px-3 py-3 text-sm" style={{ color: INK_SOFT }}>{t.allAdded}</div>
                  ) : (
                    cityOptions.map(c => (
                      <button key={c.id} onClick={() => addZone(c)}
                        className="w-full text-left px-3 py-2 text-sm"
                        style={{ color: INK }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--card-border)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        {c.name[lang]}
                      </button>
                    ))
                  )}
                </div>
              )}
              </div>
            </div>
          )}
        </div>

        {homeClock && (
          <ClockRow
            key={homeClock.id} clock={homeClock} now={now}
            selectMode={selectMode} selected={selected.includes(homeClock.id)}
            onLongPress={longPress} onTap={tap} lang={lang} t={t}
            hero isHome homeTz={homeClock.tz}
          />
        )}
      </div>

      {/* Part 2：其餘時區列表（以及尚未設定「目前位置」時的提示文字）。高度預設有上限（依畫面高度換算），
          時區加再多也不會把下面的時間軸推出畫面——超過上限的部份改成在這個範圍內自行上下捲動查看。
          收合／展開只能靠「時間軸」標題列手動往上拖曳（詳見上層的 handleWorldClockDragStart／Move／End）；
          原本清單自己捲到底/頂也會連動收合展開的功能已依需求移除，避免捲動清單時不小心誤觸收合。
          最高只能收到這裡完全消失（高度 0），不會蓋到上面 Part 1 的「目前位置」卡片或世界時鐘標題列——
          「點一下設為目前位置」這句提示原本放在 Part 1（固定不動），現在改放進這裡，
          這樣往上拖曳收合時也會一起被蓋住，而不是永遠浮在畫面上。
          大屏分欄且時間軸在右側（unlimitedHeight）時，世界時鐘自己獨占整個左欄，
          底下沒有時間軸要搶空間，這個高度上限就沒有意義了，直接取消、讓清單自然展開到底 */}
      <div
        ref={part2Ref}
        style={unlimitedHeight ? {
          maxHeight: 'none',
          overflowY: 'visible',
        } : {
          maxHeight: `${Math.max(0, part2Height)}px`,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          transition: isDraggingWorldClock ? 'none' : 'max-height 0.25s ease',
        }}
      >
        {clocks.length > 0 && !homeTzId && !selectMode && (
          <p className="text-xs pt-2 px-1" style={{ color: INK_SOFT }}>{t.setAsCurrent}</p>
        )}
        <div className={(columns === 2 ? "grid grid-cols-2 gap-2" : "flex flex-col gap-2") + " pt-1 pb-6"}>
          {clocks.length === 0 ? (
            <div className="text-sm px-2 py-4 col-span-2" style={{ color: INK_SOFT }}>{t.emptyClocks}</div>
          ) : restClocks.length === 0 ? null : (
            restClocks.map(c => (
              <ClockRow 
                key={c.id} clock={c} now={now} 
                selectMode={selectMode} selected={selected.includes(c.id)} 
                onLongPress={longPress} onTap={tap} lang={lang} t={t} 
                compact={columns === 2}
                isHome={false}
                homeTz={homeClock ? homeClock.tz : null}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// 城市詳細頁（fullPage 版世界時鐘專用）：城市名、大字時間、日期、UTC、跟目前位置的時差、
// 日出日落，以及「設為/取消設為目前位置」「從世界時鐘移除」兩個操作。
function CityDetailSheet({ clock, now, lang, t, isHome, onClose, onSetHome, onUnsetHome, onRemove, diffLabel, periodInfo }) {
  const city = CITIES.find(c => c.tz === clock.tz);
  const nameLabel = city ? city.name[lang] : clock.tz;

  const [phase, setPhase] = useState('enter');
  const CLOSE_DURATION = 60;
  useEffect(() => {
    const id = requestAnimationFrame(() => setPhase('shown'));
    return () => cancelAnimationFrame(id);
  }, []);
  function handleClose() {
    setPhase('closing');
    setTimeout(onClose, CLOSE_DURATION);
  }
  useModalBackClose(true, handleClose);
  const shown = phase === 'shown';

  const timeStr = new Intl.DateTimeFormat(LOCALE_MAP[lang], { timeZone: clock.tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const offsetStr = getUtcOffset(clock.tz, now);
  const hour = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: clock.tz, hour: 'numeric', hour12: false }).format(now), 10) % 24;
  const period = periodInfo(hour);
  const sun = (city && typeof city.lat === 'number') ? getSunTimes(now, clock.tz, city.lat, city.lng) : { sunrise: null, sunset: null };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-6"
      style={{ zIndex: 200, background: shown ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)', transition: `background ${CLOSE_DURATION}ms ease` }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-3xl p-6 flex flex-col items-center"
        style={{
          ...AUTH_GLASS,
          opacity: shown ? 1 : 0,
          transform: shown ? 'scale(1) translateY(0px)' : 'scale(0.92) translateY(14px)',
          transition: `opacity ${CLOSE_DURATION}ms ease, transform ${CLOSE_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-full flex items-center justify-end mb-2">
          <button onClick={handleClose} aria-label={t.close} style={{ color: INK_SOFT }}><X size={18} /></button>
        </div>

        <span className="font-medium" style={{ fontSize: 17, color: INK }}>{nameLabel}</span>
        <span className="font-bold tabular-nums mt-2" style={{ fontFamily: "'Quicksand', sans-serif", fontSize: 44, color: INK }}>{timeStr}</span>
        <span className="mt-1" style={{ fontSize: 13, color: INK_SOFT }}>
          {new Intl.DateTimeFormat(LOCALE_MAP[lang], { timeZone: clock.tz, month: 'long', day: 'numeric', weekday: 'short' }).format(now)}
        </span>

        <div className="flex items-center gap-1.5 mt-3" style={{ fontSize: 13, color: INK_SOFT }}>
          <period.Icon size={13} />
          <span>{period.label}</span>
        </div>

        <div className="w-full flex flex-col items-center gap-1 mt-5 pt-4" style={{ borderTop: CARD_BORDER }}>
          <span style={{ fontSize: 13, color: INK_SOFT }}>{offsetStr}</span>
          {diffLabel && <span className="font-medium" style={{ fontSize: 13, color: ACCENT }}>{diffLabel}</span>}
        </div>

        <div className="w-full flex items-center justify-around mt-5 pt-4" style={{ borderTop: CARD_BORDER }}>
          <div className="flex flex-col items-center gap-1">
            <span className="flex items-center gap-1" style={{ fontSize: 12, color: INK_SOFT }}><Sunrise size={13} />{t.sunrise}</span>
            <span className="font-medium tabular-nums" style={{ fontFamily: "'Quicksand', sans-serif", fontSize: 15, color: INK }}>{formatSunTime(sun.sunrise, clock.tz, lang, LOCALE_MAP)}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="flex items-center gap-1" style={{ fontSize: 12, color: INK_SOFT }}><Sunset size={13} />{t.sunset}</span>
            <span className="font-medium tabular-nums" style={{ fontFamily: "'Quicksand', sans-serif", fontSize: 15, color: INK }}>{formatSunTime(sun.sunset, clock.tz, lang, LOCALE_MAP)}</span>
          </div>
        </div>

        <div className="w-full flex flex-col gap-2 mt-6">
          {isHome ? (
            <button onClick={onUnsetHome} className="w-full text-center py-2.5 rounded-xl text-sm font-medium" style={{ background: CARD_BG, border: CARD_BORDER, color: INK }}>
              {t.tapToUnset}
            </button>
          ) : (
            <button onClick={onSetHome} className="w-full text-center py-2.5 rounded-xl text-sm font-medium" style={{ background: ACCENT, color: '#fff' }}>
              {t.setAsCurrent}
            </button>
          )}
          <button onClick={onRemove} className="w-full flex items-center justify-center gap-1.5 text-center py-2.5 rounded-xl text-sm font-medium" style={{ color: DANGER }}>
            <Trash2 size={14} /> {t.removeFromWorldClock}
          </button>
        </div>
      </div>
    </div>
  );
}
