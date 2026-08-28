import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, ChevronDown, ChevronLeft, X, Clock } from 'lucide-react';
import { AnalogClock, ClockRow, Flag } from './ClockCard.jsx';
import { ACCENT, AUTH_GLASS, CARD_BG, CARD_BORDER, DANGER, INK, INK_SOFT, glass } from '../../constants/colors.js';
import { LOCALE_MAP } from '../../constants/languages.js';
import { COUNTRIES } from '../../constants/worldCities.js';
import { useModalBackClose } from '../../hooks/useModalBackClose.js';
import { openDropdownExclusive, useExclusiveDropdown } from '../../hooks/useOverlayTransition.js';
import { getUtcOffset } from '../../utils/timezone.js';

export function CurrentLocationClockModal({ clock, now, restClocks, lang, t, onClose, dock = false, closing = false }) {
  const country = COUNTRIES.find(c => c.id === clock.countryId);
  const nameLabel = country ? country.name[lang] : clock.tz;
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
          <Flag flag={country ? country.flag : '🌐'} className="text-2xl leading-none" />
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
            const rc = COUNTRIES.find(x => x.id === c.countryId);
            const rZone = rc ? rc.zones.find(z => z.tz === c.tz) : null;
            const rName = rc ? rc.name[lang] : c.tz;
            const rSubLabel = rc && rc.zones.length > 1 && rZone && rZone.label ? rZone.label[lang] : null;
            const rTimeStr = new Intl.DateTimeFormat(LOCALE_MAP[lang], { timeZone: c.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
            const rOffsetStr = getUtcOffset(c.tz, now);
            return (
              <div key={c.id} className="w-full flex items-center justify-between px-4 py-3 rounded-2xl" style={{ background: CARD_BG, border: CARD_BORDER }}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <Flag flag={rc ? rc.flag : '🌐'} className="text-xl flex-shrink-0 leading-none" />
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

export function WorldClockSection({ clocks, setClocks, lang, t, onHomeTzChange, homeTzId, setHomeTzId, part2Ref, part2Height, isDraggingWorldClock, isLargeScreen = false, unlimitedHeight = false }) {
  const [now, setNow] = useState(new Date());
  const [showMenu, setShowMenu] = useState(false);
  const [submenuCountry, setSubmenuCountry] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState([]);
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
        setSubmenuCountry(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useExclusiveDropdown('timezone', showMenu, () => { setShowMenu(false); setSubmenuCountry(null); });

  const addedTz = new Set(clocks.map(c => c.tz));
  const homeClock = clocks.find(c => c.id === homeTzId) || null;

  // 將「目前位置」的時區回報給上層 App，讓頂部標題列能依此判斷早上好／中午好／晚上好
  useEffect(() => { onHomeTzChange && onHomeTzChange(homeClock ? homeClock.tz : null); }, [homeClock, onHomeTzChange]);

  function addZone(country, tz) {
    setClocks(prev => [...prev, { id: Date.now().toString(), tz, countryId: country.id }]);
    setShowMenu(false);
    setSubmenuCountry(null);
  }
  function handleCountryClick(country) {
    if (country.zones.length === 1) addZone(country, country.zones[0].tz);
    else setSubmenuCountry(country);
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

  const rootOptions = COUNTRIES.filter(c => !c.zones.every(z => addedTz.has(z.tz)));
  const subOptions = submenuCountry ? submenuCountry.zones.filter(z => !addedTz.has(z.tz)) : [];

  // Part 2 只顯示「非目前位置」的時區；目前位置改成在 Part 1 置頂區塊常駐顯示
  const restClocks = clocks.filter(c => c.id !== homeTzId);

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
                <button onClick={() => { setShowMenu(v => { const next = !v; if (next) openDropdownExclusive('timezone'); return next; }); setSubmenuCountry(null); }}
                  className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg font-medium" style={{ background: ACCENT, color: '#fff' }}>
                  <Plus size={14} /> {t.addTimezone}
                </button>
              {showMenu && (
                <div className="absolute right-0 mt-2 rounded-xl overflow-y-auto z-10" style={{ ...glass(), width: 220, maxHeight: 280, boxShadow: '0 10px 30px rgba(35,39,51,0.15)' }}>
                  {!submenuCountry ? (
                    rootOptions.length === 0 ? (
                      <div className="px-3 py-3 text-sm" style={{ color: INK_SOFT }}>{t.allAdded}</div>
                    ) : (
                      rootOptions.map(c => (
                        <button key={c.id} onClick={() => handleCountryClick(c)}
                          className="w-full flex items-center justify-between text-left px-3 py-2 text-sm"
                          style={{ color: INK }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--card-border)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <span className="flex items-center gap-1.5">
                            <Flag flag={c.flag} style={{ display: 'inline-block', lineHeight: 1 }} />
                            {c.name[lang]}
                          </span>
                          {c.zones.length > 1 && <ChevronDown size={14} style={{ transform: 'rotate(-90deg)', color: INK_SOFT }} />}
                        </button>
                      ))
                    )
                  ) : (
                    <div>
                      <button onClick={() => setSubmenuCountry(null)} className="w-full flex items-center gap-1 text-left px-3 py-2 text-sm font-medium" style={{ color: ACCENT, borderBottom: CARD_BORDER }}>
                        <ChevronLeft size={14} /> {t.back}
                      </button>
                      {subOptions.length === 0 ? (
                        <div className="px-3 py-3 text-sm" style={{ color: INK_SOFT }}>{t.allAdded}</div>
                      ) : (
                        subOptions.map(z => (
                          <button key={z.tz} onClick={() => addZone(submenuCountry, z.tz)}
                                                      className="w-full text-left px-3 py-2 text-sm"
                            style={{ color: INK }} 
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--card-border)')} 
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            {z.label ? z.label[lang] : z.tz}
                          </button>
                        ))
                      )}
                    </div>
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
