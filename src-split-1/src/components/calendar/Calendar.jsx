import { useState, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ACCENT, AUTH_GLASS, CARD_BORDER, INK, INK_SOFT, colorHex, glass } from '../../constants/colors.js';
import { LOCALE_MAP } from '../../constants/languages.js';
import { useModalBackClose } from '../../hooks/useModalBackClose.js';
import { addDays, buildMonthCells, buildWeekDates, computeEventsByDayForMonth, computeMonthsHaveEvents, computeWeekEventsByDateKey, shiftMonth } from '../../utils/date.js';
import { getEffectiveDate, getEventOccurrencesInRange, getYearlyOccurrenceInYear } from '../../utils/event.js';
import { formatAltCalendar } from '../../utils/lunar.js';

export function useSwipeCarousel(onCommit) {
  const containerRef = useRef(null);
  const [dragX, setDragX] = useState(0);
  const [transitionOn, setTransitionOn] = useState(false);
  const startRef = useRef(null);
  const axisRef = useRef(null);
  const widthRef = useRef(320);
  const pendingRef = useRef(null);
  const dragXRef = useRef(0);
  function onTouchStart(e) {
    const touch = e.touches[0];
    startRef.current = { x: touch.clientX, y: touch.clientY };
    axisRef.current = null;
    widthRef.current = (containerRef.current && containerRef.current.offsetWidth) || 320;
    setTransitionOn(false);
  }
  function onTouchMove(e) {
    if (!startRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startRef.current.x;
    const dy = touch.clientY - startRef.current.y;
    if (axisRef.current == null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; // 移動還太小，先不判斷方向
      axisRef.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (axisRef.current !== 'x') return; // 判斷成上下捲動，這次手勢整段都不介入橫向位移
    const w = widthRef.current;
    const clamped = Math.max(-w, Math.min(w, dx));
    dragXRef.current = clamped;
    setDragX(clamped);
  }
  function onTouchEnd() {
    if (!startRef.current) return;
    startRef.current = null;
    if (axisRef.current !== 'x') { axisRef.current = null; return; }
    axisRef.current = null;
    const w = widthRef.current;
    const threshold = Math.max(48, w * 0.22);
    setTransitionOn(true);
    if (dragXRef.current <= -threshold) {
      pendingRef.current = 'next';
      setDragX(-w);
    } else if (dragXRef.current >= threshold) {
      pendingRef.current = 'prev';
      setDragX(w);
    } else {
      pendingRef.current = null;
      setDragX(0);
    }
  }
  function handleTransitionEnd(e) {
    if (e.target !== e.currentTarget) return; // 只認外層那個真正在位移的容器觸發的事件
    const dir = pendingRef.current;
    pendingRef.current = null;
    setTransitionOn(false);
    dragXRef.current = 0;
    setDragX(0);
    if (dir) onCommit(dir);
  }
  return { containerRef, dragX, transitionOn, onTouchStart, onTouchMove, onTouchEnd, handleTransitionEnd };
}

export const AnniversaryCalendar = forwardRef(function AnniversaryCalendar({ events, lang, t, now, onRangeChange, viewMode, setViewMode, enabledAltCalendars }, ref) {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11，viewMode==='year'／'week' 時不使用
  // viewMode（'month'＝月曆格子；'year'＝12 個月的年曆格子；'week'＝一週 7 天）改由外層 App
  // 控制（見需求四：頂部標題列跟日曆之間的年／月／週滑塊），這裡不再自己 useState。
  const [weekAnchor, setWeekAnchor] = useState(now); // 週檢視專用：這一週裡任一天，用來算出這一週的週日～週六範圍
  const [selectedDay, setSelectedDay] = useState(null); // 月檢視專用，點日期在下面秀一小段當天預覽
  const [selectedWeekDate, setSelectedWeekDate] = useState(null); // 週檢視專用，選中的完整日期（週可能橫跨兩個月，不能只存「日」這個數字）
  // 收合／展開：預設展開。收合時只留標題列（含收合鈕），下面的日期格子／年曆格子、選中日
  // 預覽整塊收合，讓下面的事件卡片能拿到更多空間——用 maxHeight+opacity
  // 做轉場，跟其他彈窗輸入框放大/收合是同一套手法。
  const [collapsed, setCollapsed] = useState(false);
  const COLLAPSE_TRANSITION_MS = 260;

  // 年份／月份選擇面板：沿用「刪除地標」確認彈窗同一套置中卡片＋淡入淡出/位移縮放動畫
  // （enter -> shown -> closing 三段式 phase），跟整個 App 目前所有彈窗是同一種呈現方式，
  // 不另外發明這個 App 裡沒出現過的「由下往上彈出」樣式。
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPhase, setPickerPhase] = useState('hidden');
  const [pickerYear, setPickerYear] = useState(year); // 面板裡暫存的年份，選定月份或年份選單確認前不影響外面的日曆
  const PICKER_DURATION = 200;

  // 年份選單：從第一層面板點目前年份彈出的第二層選單，疊在第一層之上，選好一個年份就
  // 收回第一層繼續選月份，不用先關掉整個面板。gridStart 是目前選單顯示的 12 年區間起點，
  // 開啟當下以 pickerYear 為中心，前後翻頁各自 ±12 年，一樣可以跳到很久以前或以後的年份。
  const [yearMenuOpen, setYearMenuOpen] = useState(false);
  const [yearMenuPhase, setYearMenuPhase] = useState('hidden');
  const [yearMenuGridStart, setYearMenuGridStart] = useState(year - 5);

  function openPicker() {
    setPickerYear(year);
    setPickerOpen(true);
    setPickerPhase('enter');
    requestAnimationFrame(() => setPickerPhase('shown'));
  }
  function closePicker() {
    if (pickerPhase === 'closing') return;
    setPickerPhase('closing');
    setTimeout(() => { setPickerOpen(false); setPickerPhase('hidden'); }, PICKER_DURATION);
  }
  useModalBackClose(pickerOpen, closePicker);

  // 年份／月份選擇面板原本是日曆自己左上角標題按鈕觸發，現在改由頂部標題列（Header）的
  // 標題文字觸發（見需求一：移除日曆左上角選擇年份月份的按鈕，改放到頂部標題列），所以
  // 用 useImperativeHandle 把開啟面板的函式透過 ref 交給外層 App，App 裡 Header 的標題
  // 文字直接呼叫 calendarRef.current.openPicker()，不用把整個面板／選單狀態都搬到 App 裡。
  useImperativeHandle(ref, () => ({ openPicker }));

  function openYearMenu() {
    setYearMenuGridStart(pickerYear - 5);
    setYearMenuOpen(true);
    setYearMenuPhase('enter');
    requestAnimationFrame(() => setYearMenuPhase('shown'));
  }
  function closeYearMenu() {
    if (yearMenuPhase === 'closing') return;
    setYearMenuPhase('closing');
    setTimeout(() => { setYearMenuOpen(false); setYearMenuPhase('hidden'); }, PICKER_DURATION);
  }
  useModalBackClose(yearMenuOpen, closeYearMenu);
  function pickYearFromMenu(y) {
    setPickerYear(y);
    closeYearMenu();
  }

  const firstOfMonth = new Date(year, month, 1);

  // 週檢視的範圍：週日～週六（跟月曆格子的星期排列一致），用 weekAnchor（這一週裡任一天）算出來。
  const weekStart = useMemo(() => {
    const d = new Date(weekAnchor.getFullYear(), weekAnchor.getMonth(), weekAnchor.getDate());
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, [weekAnchor]);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStart]);
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  }), [weekStart]);
  // 週檢視專用的事件對照表：key 是 "年-月-日"，用通用的日期區間比對（見 getEventOccurrencesInRange
  // 開頭註解），因為一週可能橫跨兩個西曆月份／年份，不能沿用月檢視「單一年月」的算法。
  const weekEventsByDateKey = useMemo(() => {
    const map = {};
    if (viewMode !== 'week') return map;
    getEventOccurrencesInRange(events, weekStart, weekEnd).forEach(({ ev, occ }) => {
      const key = `${occ.getFullYear()}-${occ.getMonth()}-${occ.getDate()}`;
      (map[key] = map[key] || []).push(ev);
    });
    return map;
  }, [events, weekStart, weekEnd, viewMode]);

  // 修復同一個 bug（見 getYearlyOccurrenceInYear 開頭註解）：月檢視原本直接用「這個月 1 號」
  // 當基準呼叫 getEffectiveDate，對農曆等需要「往未來逐日掃描找符合區塊」的曆法來說，如果
  // 事件在該農曆月份的實際西曆日期已經在這個月 1 號之前發生過，就會誤判、退而返回區塊最後
  // 一天頂替，常常跨進下個月——導致同一個農曆生日在切換月份瀏覽時，連續兩個月都被點上圓點。
  // 月重複（repeatUnit==='month'，只有西曆才會這樣設定）本來就該每個月各自出現一次，
  // 繼續用「這個月 1 號」當基準沒問題；不循環或年重複的事件改用 getYearlyOccurrenceInYear
  // （用目標年份 1 月 1 號當基準，保證一定在目標發生日之前），一年只算一次、只會落在唯一一個月份。
  const eventsByDay = useMemo(() => {
    const map = {};
    events.forEach(ev => {
      const occ = ev.repeat && ev.repeatUnit === 'month'
        ? getEffectiveDate(ev, firstOfMonth)
        : getYearlyOccurrenceInYear(ev, year);
      if (occ.getFullYear() === year && occ.getMonth() === month) {
        const d = occ.getDate();
        (map[d] = map[d] || []).push(ev);
      }
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, year, month]);

  // 年檢視：12 個月各自算一次「這個月有沒有落上任何事件」，跟月檢視同一套邏輯（見上面
  // eventsByDay 的註解），只是逐月掃描，不會跟月檢視或下面的日程列表算出兩套不同的日期判斷結果。
  const monthsHaveEvents = useMemo(() => {
    const monthlyRepeatEvents = events.filter(ev => ev.repeat && ev.repeatUnit === 'month');
    const yearlyOrFixedOccurrences = events
      .filter(ev => !(ev.repeat && ev.repeatUnit === 'month'))
      .map(ev => getYearlyOccurrenceInYear(ev, year))
      .filter(occ => occ.getFullYear() === year);
    return Array.from({ length: 12 }, (_, m) => {
      if (yearlyOrFixedOccurrences.some(occ => occ.getMonth() === m)) return true;
      const ref = new Date(year, m, 1);
      return monthlyRepeatEvents.some(ev => {
        const occ = getEffectiveDate(ev, ref);
        return occ.getFullYear() === year && occ.getMonth() === m;
      });
    });
  }, [events, year]);

  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(LOCALE_MAP[lang], { weekday: 'short' }).format(new Date(2023, 0, 1 + i))
  );
  const monthLabels = Array.from({ length: 12 }, (_, m) =>
    new Intl.DateTimeFormat(LOCALE_MAP[lang], { month: 'short' }).format(new Date(2023, m, 1))
  );

  // 日曆切換／捲動操作：月檢視是上一月/下一月，年檢視是上一年/下一年，週檢視是上一週/下一週，
  // 不再用畫面上的按鈕觸發，改成日曆格子左右滑動（見下方 JSX 的 onTouchStart/onTouchEnd）。
  function goPrev() {
    setSelectedDay(null);
    if (viewMode === 'year') { setYear(y => y - 1); return; }
    if (viewMode === 'week') { setWeekAnchor(d => addDays(d, -7)); setSelectedWeekDate(null); return; }
    if (month === 0) { setYear(y => y - 1); setMonth(11); } else { setMonth(m => m - 1); }
  }
  function goNext() {
    setSelectedDay(null);
    if (viewMode === 'year') { setYear(y => y + 1); return; }
    if (viewMode === 'week') { setWeekAnchor(d => addDays(d, 7)); setSelectedWeekDate(null); return; }
    if (month === 11) { setYear(y => y + 1); setMonth(0); } else { setMonth(m => m + 1); }
  }
  // 選擇面板裡點了月份宮格：立即套用選定的年份＋月份、切到月檢視並關閉面板
  function pickMonth(m) {
    setYear(pickerYear);
    setMonth(m);
    setViewMode('month');
    setSelectedDay(null);
    closePicker();
  }
  // 只選年份、不指定月份：切到年檢視
  function pickWholeYear() {
    setYear(pickerYear);
    setViewMode('year');
    setSelectedDay(null);
    closePicker();
  }

  // 日曆目前顯示的時間範圍（月／年／週）一有變動就同步給上層，下面的日程列表跟著這個範圍
  // 即時更新（見需求六：日曆與日程列表不能各自使用不同的時間範圍）。週檢視額外帶上
  // weekStart／weekEnd（真正的 Date），因為一週可能橫跨兩個西曆月份／年份，不能只用單一年月表示。
  useEffect(() => {
    if (viewMode === 'year') { onRangeChange && onRangeChange({ mode: 'year', year }); return; }
    if (viewMode === 'week') { onRangeChange && onRangeChange({ mode: 'week', year: weekStart.getFullYear(), weekStart, weekEnd }); return; }
    onRangeChange && onRangeChange({ mode: 'month', year, month });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, year, month, weekStart, weekEnd]);

  const cells = buildMonthCells(year, month);
  // 月檢視左右滑動輪播：上一個／目前／下一個月份的日期格子＋各自的事件對照表都各算一次，
  // 鋪成三個並排的滑動面板（見 useSwipeCarousel、buildMonthCells、computeEventsByDayForMonth
  // 開頭註解）。放開手勢判斷要不要換頁時直接呼叫既有的 goPrev／goNext，跟原本點按鈕是
  // 同一套換月邏輯，只是觸發方式從按鈕點擊改成滑動手勢判定完成。
  const prevMonthYM = shiftMonth(year, month, -1);
  const nextMonthYM = shiftMonth(year, month, 1);
  const monthPanelCells = useMemo(() => ({
    prev: buildMonthCells(prevMonthYM.y, prevMonthYM.m),
    next: buildMonthCells(nextMonthYM.y, nextMonthYM.m),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [year, month]);
  const monthPanelEventsByDay = useMemo(() => ({
    prev: computeEventsByDayForMonth(events, prevMonthYM.y, prevMonthYM.m),
    next: computeEventsByDayForMonth(events, nextMonthYM.y, nextMonthYM.m),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [events, year, month]);
  const monthCarousel = useSwipeCarousel((dir) => { if (dir === 'next') goNext(); else goPrev(); });

  // 週檢視左右滑動輪播：跟月檢視同一套「跟手拖曳、放開判斷換頁」邏輯（見 useSwipeCarousel
  // 開頭註解），上一週／下一週各自的 7 個日期＋事件對照表都各算一次，鋪成三個並排的滑動面板
  // （見需求二：年、週也要跟月一樣有真正跟手拖曳的滑動切換效果）。
  const prevWeekDates = useMemo(() => buildWeekDates(addDays(weekStart, -7)), [weekStart]);
  const nextWeekDates = useMemo(() => buildWeekDates(addDays(weekStart, 7)), [weekStart]);
  const weekPanelEventsByDateKey = useMemo(() => ({
    prev: computeWeekEventsByDateKey(events, prevWeekDates),
    next: computeWeekEventsByDateKey(events, nextWeekDates),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [events, weekStart]);
  const weekCarousel = useSwipeCarousel((dir) => { if (dir === 'next') goNext(); else goPrev(); });

  // 年檢視左右滑動輪播：同一套邏輯，上一年／下一年各自的 12 個月「有沒有事件」各算一次。
  const monthsHaveEventsPanel = useMemo(() => ({
    prev: computeMonthsHaveEvents(events, year - 1),
    next: computeMonthsHaveEvents(events, year + 1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [events, year]);
  const yearCarousel = useSwipeCarousel((dir) => { if (dir === 'next') goNext(); else goPrev(); });

  const isToday = (d) => d === now.getDate() && month === now.getMonth() && year === now.getFullYear();
  const selectedEvents = selectedDay != null ? (eventsByDay[selectedDay] || []) : [];
  // 月檢視選中的「日」只存數字（見上面 selectedDay 的宣告註解），要換算成其他曆法對應日期
  // 得先湊回完整的 Date；週檢視的 selectedWeekDate 本來就是完整 Date，不用另外處理。
  const selectedDayDate = selectedDay != null ? new Date(year, month, selectedDay) : null;
  const isTodayDate = (d) => d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const selectedWeekEvents = selectedWeekDate
    ? (weekEventsByDateKey[`${selectedWeekDate.getFullYear()}-${selectedWeekDate.getMonth()}-${selectedWeekDate.getDate()}`] || [])
    : [];

  // 月檢視滑動輪播裡，「上一個／目前／下一個」三個面板共用同一份格子渲染邏輯，只有中間
  // （isCurrentPanel）那一格會回應點擊、顯示選中狀態；兩側面板單純只是滑動時的視覺預覽，
  // pointerEvents:none 避免手指划到一半、還沒放開就不小心點到旁邊面板的日期。
  function renderMonthGridPanel(panelCells, panelEventsByDay, panelYear, panelMonth, isCurrentPanel) {
    return (
      <div className="grid grid-cols-7 gap-y-1 text-center" style={{ pointerEvents: isCurrentPanel ? 'auto' : 'none' }}>
        {panelCells.map((c, i) => {
          const dayEvents = c.inMonth ? (panelEventsByDay[c.day] || []) : [];
          const selected = isCurrentPanel && c.inMonth && selectedDay === c.day;
          const today = c.inMonth && c.day === now.getDate() && panelMonth === now.getMonth() && panelYear === now.getFullYear();
          return (
            <button
              key={i}
              disabled={!c.inMonth}
              onClick={() => setSelectedDay(prev => (prev === c.day ? null : c.day))}
              className="flex flex-col items-center justify-center py-1"
              style={{ opacity: c.inMonth ? 1 : 0.25 }}
            >
              <span
                className="flex items-center justify-center rounded-full text-xs font-bold"
                style={{
                  width: 26,
                  height: 26,
                  background: selected ? ACCENT : (today ? 'var(--card-border)' : 'transparent'),
                  color: selected ? '#fff' : INK,
                }}
              >
                {c.day}
              </span>
              <span className="flex items-center justify-center gap-0.5 mt-0.5" style={{ height: 4 }}>
                {dayEvents.slice(0, 3).map((ev, di) => (
                  <span key={di} className="rounded-full" style={{ width: 4, height: 4, background: colorHex(ev.colorId) }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  // 週檢視滑動輪播裡「上一週／目前／下一週」三個面板共用同一份渲染邏輯，跟月檢視的
  // renderMonthGridPanel 是同一種寫法：只有 isCurrentPanel 那一格會回應點擊、顯示選中狀態，
  // 兩側面板 pointerEvents:none 純粹是滑動時的視覺預覽。
  function renderWeekGridPanel(panelDates, panelEventsByDateKey, isCurrentPanel) {
    return (
      <div className="grid grid-cols-7 gap-y-1 text-center" style={{ pointerEvents: isCurrentPanel ? 'auto' : 'none' }}>
        {panelDates.map((d, i) => {
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          const dayEvents = panelEventsByDateKey[key] || [];
          const selected = isCurrentPanel && selectedWeekDate && selectedWeekDate.getTime() === d.getTime();
          return (
            <button
              key={i}
              onClick={() => setSelectedWeekDate(prev => (prev && prev.getTime() === d.getTime() ? null : d))}
              className="flex flex-col items-center justify-center py-1"
            >
              <span
                className="flex items-center justify-center rounded-full text-xs font-bold"
                style={{
                  width: 26,
                  height: 26,
                  background: selected ? ACCENT : (isTodayDate(d) ? 'var(--card-border)' : 'transparent'),
                  color: selected ? '#fff' : INK,
                }}
              >
                {d.getDate()}
              </span>
              <span className="flex items-center justify-center gap-0.5 mt-0.5" style={{ height: 4 }}>
                {dayEvents.slice(0, 3).map((ev, di) => (
                  <span key={di} className="rounded-full" style={{ width: 4, height: 4, background: colorHex(ev.colorId) }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  // 年檢視滑動輪播裡「上一年／目前／下一年」三個面板共用同一份渲染邏輯，同樣只有
  // isCurrentPanel 那一格能點擊切回月檢視，兩側面板 pointerEvents:none。
  function renderYearGridPanel(panelYear, panelMonthsHaveEvents, isCurrentPanel) {
    return (
      <div className="grid grid-cols-3 gap-2" style={{ pointerEvents: isCurrentPanel ? 'auto' : 'none' }}>
        {monthLabels.map((label, m) => {
          const isCurrentMonth = m === now.getMonth() && panelYear === now.getFullYear();
          return (
            <button
              key={m}
              onClick={() => { setMonth(m); setViewMode('month'); setSelectedDay(null); }}
              className="flex flex-col items-center justify-center py-3 rounded-xl"
              style={{ background: isCurrentMonth ? 'var(--card-border)' : 'transparent' }}
            >
              <span className="text-sm font-bold" style={{ color: INK }}>{label}</span>
              <span className="flex items-center justify-center mt-1" style={{ height: 4 }}>
                {panelMonthsHaveEvents[m] && <span className="rounded-full" style={{ width: 4, height: 4, background: ACCENT }} />}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  // 標題文字（年份／年月／週範圍）已經改由頂部標題列（Header）自己格式化顯示（見 App 內
  // Header 那段跟這裡同一套格式化邏輯），日曆本身不再需要重複算一份、也不再有標題按鈕可以顯示它。
  const pickerYearLabel = new Intl.DateTimeFormat(LOCALE_MAP[lang], { year: 'numeric' }).format(new Date(pickerYear, 0, 1));
  const yearMenuYears = Array.from({ length: 12 }, (_, i) => yearMenuGridStart + i);

  return (
    <div className="rounded-2xl p-3 flex-shrink-0" style={glass()}>
      {/* 標題列：年份／月份選擇按鈕已移除，改由頂部標題列（Header）的標題文字觸發同一個
          面板（見上方 useImperativeHandle）；這裡只剩收合鈕，連同左側「收合／展開」灰色
          小字一起靠右對齊。文字本身純粹是說明目前按下去會發生什麼事，不能點——真正可點的
          只有右邊那顆圓形按鈕，避免兩塊點擊區域疊在一起互相干擾。 */}
      <div className="flex items-center justify-end gap-1.5 mb-2">
        <span className="text-xs" style={{ color: INK_SOFT }}>
          {collapsed ? t.calendarExpandLabel : t.calendarCollapseLabel}
        </span>
        <button
          onClick={() => setCollapsed(v => !v)}
          aria-label={t.calendarToggleCollapse}
          className="flex items-center justify-center rounded-full"
          style={{ width: 24, height: 24, color: INK_SOFT }}
        >
          <ChevronDown
            size={16}
            style={{
              transform: collapsed ? 'rotate(-90deg)' : 'none',
              transition: `transform ${COLLAPSE_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            }}
          />
        </button>
      </div>

      <div
        style={{
          maxHeight: collapsed ? 0 : 480,
          opacity: collapsed ? 0 : 1,
          overflow: 'hidden',
          transition: `max-height ${COLLAPSE_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${COLLAPSE_TRANSITION_MS * 0.7}ms ease`,
        }}
      >
        {viewMode === 'month' ? (
          // 月檢視：星期標籤固定在最上面不參與滑動，下面才是「上一個／目前／下一個」三個月份
          // 並排的滑動面板（見 useSwipeCarousel 開頭註解）——手指拖曳時三個面板跟著手指一起
          // 橫向移動，日曆本身（這個外層容器）的位置完全不動，放開後才決定要停在哪一頁、
          // 用 onTransitionEnd 在動畫剛好結束的那一刻換上新月份的資料、瞬間歸零位移，
          // 銜接起來看不出破綻，不會卡頓、跳動或日期對錯位。
          <>
            <div className="grid grid-cols-7 text-center">
              {weekdayLabels.map((w, i) => (
                <span key={i} className="text-[10px] font-bold" style={{ color: INK_SOFT }}>{w}</span>
              ))}
            </div>
            <div
              ref={monthCarousel.containerRef}
              onTouchStart={monthCarousel.onTouchStart}
              onTouchMove={monthCarousel.onTouchMove}
              onTouchEnd={monthCarousel.onTouchEnd}
              style={{ overflow: 'hidden', touchAction: 'pan-y' }}
            >
              <div
                onTransitionEnd={monthCarousel.handleTransitionEnd}
                style={{
                  display: 'flex',
                  width: '300%',
                  transform: `translateX(calc(-100%/3 + ${monthCarousel.dragX}px))`,
                  transition: monthCarousel.transitionOn ? 'transform 280ms cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none',
                  willChange: 'transform',
                }}
              >
                <div style={{ width: '33.3333%', flexShrink: 0 }}>
                  {renderMonthGridPanel(monthPanelCells.prev, monthPanelEventsByDay.prev, prevMonthYM.y, prevMonthYM.m, false)}
                </div>
                <div style={{ width: '33.3333%', flexShrink: 0 }}>
                  {renderMonthGridPanel(cells, eventsByDay, year, month, true)}
                </div>
                <div style={{ width: '33.3333%', flexShrink: 0 }}>
                  {renderMonthGridPanel(monthPanelCells.next, monthPanelEventsByDay.next, nextMonthYM.y, nextMonthYM.m, false)}
                </div>
              </div>
            </div>
          </>
        ) : viewMode === 'week' ? (
          // 週檢視：跟月檢視同一套三面板跟手拖曳滑動（見需求二），星期標籤固定不參與滑動，
          // 下面才是「上一週／目前／下一週」三個並排面板，格子改成該週實際的 7 天（可能橫跨
          // 兩個月，每格顯示「日」的數字取自該天真正的 Date，不是固定在同一個月份底下）。
          <>
            <div className="grid grid-cols-7 text-center">
              {weekdayLabels.map((w, i) => (
                <span key={i} className="text-[10px] font-bold" style={{ color: INK_SOFT }}>{w}</span>
              ))}
            </div>
            <div
              ref={weekCarousel.containerRef}
              onTouchStart={weekCarousel.onTouchStart}
              onTouchMove={weekCarousel.onTouchMove}
              onTouchEnd={weekCarousel.onTouchEnd}
              style={{ overflow: 'hidden', touchAction: 'pan-y' }}
            >
              <div
                onTransitionEnd={weekCarousel.handleTransitionEnd}
                style={{
                  display: 'flex',
                  width: '300%',
                  transform: `translateX(calc(-100%/3 + ${weekCarousel.dragX}px))`,
                  transition: weekCarousel.transitionOn ? 'transform 280ms cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none',
                  willChange: 'transform',
                }}
              >
                <div style={{ width: '33.3333%', flexShrink: 0 }}>
                  {renderWeekGridPanel(prevWeekDates, weekPanelEventsByDateKey.prev, false)}
                </div>
                <div style={{ width: '33.3333%', flexShrink: 0 }}>
                  {renderWeekGridPanel(weekDates, weekEventsByDateKey, true)}
                </div>
                <div style={{ width: '33.3333%', flexShrink: 0 }}>
                  {renderWeekGridPanel(nextWeekDates, weekPanelEventsByDateKey.next, false)}
                </div>
              </div>
            </div>
          </>
        ) : (
          // 年檢視：跟月檢視同一套三面板跟手拖曳滑動（見需求二），12 個月排成 3x4 格子取代
          // 日格子，只標示「這個月有沒有事件」，點一個月直接切回月檢視並定位到那個月。
          <div
            ref={yearCarousel.containerRef}
            onTouchStart={yearCarousel.onTouchStart}
            onTouchMove={yearCarousel.onTouchMove}
            onTouchEnd={yearCarousel.onTouchEnd}
            style={{ overflow: 'hidden', touchAction: 'pan-y' }}
          >
            <div
              onTransitionEnd={yearCarousel.handleTransitionEnd}
              style={{
                display: 'flex',
                width: '300%',
                transform: `translateX(calc(-100%/3 + ${yearCarousel.dragX}px))`,
                transition: yearCarousel.transitionOn ? 'transform 280ms cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none',
                willChange: 'transform',
              }}
            >
              <div style={{ width: '33.3333%', flexShrink: 0 }}>
                {renderYearGridPanel(year - 1, monthsHaveEventsPanel.prev, false)}
              </div>
              <div style={{ width: '33.3333%', flexShrink: 0 }}>
                {renderYearGridPanel(year, monthsHaveEvents, true)}
              </div>
              <div style={{ width: '33.3333%', flexShrink: 0 }}>
                {renderYearGridPanel(year + 1, monthsHaveEventsPanel.next, false)}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'month' && selectedDay != null && (
          <div className="mt-3 pt-3 flex flex-col gap-2" style={{ borderTop: CARD_BORDER }}>
            {selectedEvents.length === 0 ? (
              <p className="text-xs text-center" style={{ color: INK_SOFT }}>—</p>
            ) : (
              selectedEvents.map(ev => (
                <div key={ev.id} className="flex items-center gap-2">
                  <span className="text-lg">{ev.icon}</span>
                  <span className="text-sm font-bold flex-1 truncate" style={{ color: INK }}>{ev.title}</span>
                </div>
              ))
            )}
            {/* 「我的」→「日曆」裡勾選的曆法（可複選），選中日期底下各自換算顯示一行；
                跟事件列表用同一塊面板，用細分隔線隔開，沒勾任何曆法就完全不出現這一段。 */}
            {enabledAltCalendars.length > 0 && selectedDayDate && (
              <div className="flex flex-col gap-1 pt-2 mt-1" style={{ borderTop: CARD_BORDER }}>
                {enabledAltCalendars.map(calId => {
                  const text = formatAltCalendar(selectedDayDate, calId, lang, t);
                  return text ? <p key={calId} className="text-xs" style={{ color: INK_SOFT }}>{text}</p> : null;
                })}
              </div>
            )}
          </div>
        )}

        {viewMode === 'week' && selectedWeekDate != null && (
          <div className="mt-3 pt-3 flex flex-col gap-2" style={{ borderTop: CARD_BORDER }}>
            {selectedWeekEvents.length === 0 ? (
              <p className="text-xs text-center" style={{ color: INK_SOFT }}>—</p>
            ) : (
              selectedWeekEvents.map(ev => (
                <div key={ev.id} className="flex items-center gap-2">
                  <span className="text-lg">{ev.icon}</span>
                  <span className="text-sm font-bold flex-1 truncate" style={{ color: INK }}>{ev.title}</span>
                </div>
              ))
            )}
            {enabledAltCalendars.length > 0 && (
              <div className="flex flex-col gap-1 pt-2 mt-1" style={{ borderTop: CARD_BORDER }}>
                {enabledAltCalendars.map(calId => {
                  const text = formatAltCalendar(selectedWeekDate, calId, lang, t);
                  return text ? <p key={calId} className="text-xs" style={{ color: INK_SOFT }}>{text}</p> : null;
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 年份／月份選擇面板：月份直接用 12 宮格挑（點了立即套用並關閉面板），不再用「月／年」
          分頁文字切換；面板頂端的年份數字本身就是按鈕，點下去彈出第二層年份選單（見下方），
          在裡面挑好年份後收回這一層繼續選月份。想直接檢視整年，用月份宮格下面的文字連結。 */}
      {pickerOpen && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center px-6"
          style={{
            zIndex: 205,
            background: pickerPhase === 'shown' ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
            opacity: pickerPhase === 'hidden' ? 0 : 1,
            transition: `background ${PICKER_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${PICKER_DURATION}ms ease`,
          }}
          onClick={closePicker}
        >
          <div
            className="w-full max-w-xs p-4 rounded-2xl flex flex-col gap-3"
            style={{
              ...AUTH_GLASS,
              opacity: pickerPhase === 'shown' ? 1 : 0,
              transform: pickerPhase === 'shown' ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.97)',
              transition: `opacity ${PICKER_DURATION}ms ease, transform ${PICKER_DURATION}ms cubic-bezier(0.34, 1.2, 0.64, 1)`,
              willChange: 'opacity, transform',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              {/* 目前年份：直接點下去開第二層年份選單，取代原本的「月／年」分頁切換文字 */}
              <button onClick={openYearMenu} className="flex items-center gap-1" aria-label={t.calendarChooseDate}>
                <span className="text-base font-black" style={{ color: INK }}>{pickerYearLabel}</span>
                <ChevronDown size={14} style={{ color: INK_SOFT }} />
              </button>
              <button onClick={closePicker} aria-label={t.close} style={{ color: INK_SOFT }}><X size={16} /></button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {monthLabels.map((label, m) => {
                const isCurrentSelection = viewMode === 'month' && pickerYear === year && m === month;
                return (
                  <button
                    key={m}
                    onClick={() => pickMonth(m)}
                    className="py-2 rounded-lg text-sm font-bold"
                    style={{
                      background: isCurrentSelection ? ACCENT : 'var(--card-border)',
                      color: isCurrentSelection ? '#fff' : INK,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <button onClick={pickWholeYear} className="py-2 rounded-xl text-sm font-bold" style={{ background: 'var(--card-border)', color: INK }}>
              {t.calendarViewWholeYear}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* 第二層年份選單：疊在第一層面板之上，12 年一頁，用左右箭頭翻頁，選一個年份就收回
          第一層繼續選月份（見需求：點目前年份彈出二級選單選擇年份）。 */}
      {yearMenuOpen && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center px-6"
          style={{
            zIndex: 215,
            background: yearMenuPhase === 'shown' ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
            opacity: yearMenuPhase === 'hidden' ? 0 : 1,
            transition: `background ${PICKER_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${PICKER_DURATION}ms ease`,
          }}
          onClick={closeYearMenu}
        >
          <div
            className="w-full max-w-xs p-4 rounded-2xl flex flex-col gap-3"
            style={{
              ...AUTH_GLASS,
              opacity: yearMenuPhase === 'shown' ? 1 : 0,
              transform: yearMenuPhase === 'shown' ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.97)',
              transition: `opacity ${PICKER_DURATION}ms ease, transform ${PICKER_DURATION}ms cubic-bezier(0.34, 1.2, 0.64, 1)`,
              willChange: 'opacity, transform',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <button onClick={() => setYearMenuGridStart(s => s - 12)} aria-label={t.calendarPrev} style={{ color: INK_SOFT }}><ChevronLeft size={18} /></button>
              <span className="text-sm font-bold" style={{ color: INK }}>{yearMenuYears[0]} - {yearMenuYears[11]}</span>
              <button onClick={() => setYearMenuGridStart(s => s + 12)} aria-label={t.calendarNext} style={{ color: INK_SOFT }}><ChevronRight size={18} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {yearMenuYears.map(y => (
                <button
                  key={y}
                  onClick={() => pickYearFromMenu(y)}
                  className="py-2 rounded-lg text-sm font-bold"
                  style={{
                    background: y === pickerYear ? ACCENT : 'var(--card-border)',
                    color: y === pickerYear ? '#fff' : INK,
                  }}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});
