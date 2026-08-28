import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, ChevronDown, X, MapPin, Check, Clock, Pencil, Search, Images } from 'lucide-react';
import { CalendarDatePicker } from '../calendar/DatePicker.jsx';
import { LandmarkDetailModal } from '../event/EventDetail.jsx';
import { PastEventsAnimatedSection } from './PastLandmarks.jsx';
import { ACCENT, AUTH_GLASS, CARD_BORDER, CARE_COLOR_TAGS, CARE_ICONS, CARE_MODE_VARS, COLOR_TAGS, DANGER, ICONS, INK, INK_SOFT, INPUT_BG, MINT, colorHex, glass, iconPickStyle } from '../../constants/colors.js';
import { EVENT_MODES, ICON_SUBMENUS, eventModeFromEv } from '../../constants/eventModes.js';
import { LOCALE_MAP } from '../../constants/languages.js';
import { CAL_OPTIONS } from '../../constants/worldCities.js';
import { useModalBackClose } from '../../hooks/useModalBackClose.js';
import { accentAlpha } from '../../utils/accentAlpha.js';
import { combineDateTime } from '../../utils/date.js';
import { getEffectiveDate, getEventOccurrencesInRange, getYearlyOccurrenceInYear } from '../../utils/event.js';
import { formatAltCalendar } from '../../utils/lunar.js';

export const EVENT_CARD_GAP = 24;

export function TimelineSection({
  events, setEvents, lang, t, now, isDark, customIcons, setCustomIcons,
  onHeaderDragStart, onHeaderDragMove, onHeaderDragEnd,
  isLargeScreen = false, viewingId, setViewingId, onOpenAlbumForEvent,
  // layout='timeline'（預設）＝「時光線」分頁目前的樣子，完全不動：時間軸線、圓點、
  // 往日地標收合區塊全部保留。layout='cards'＝「日程」分頁用，資料/邏輯完全共用同一份
  // （events／processedEvents／新增編輯刪除相冊等等都沒有另外複製一份），只是渲染時
  // 跳過時間軸視覺（軸線／圓點／pl-6 縮排）跟「往日地標」這個區塊，改成單純的事件卡片列表。
  layout = 'timeline',
  // 以下三個 prop 只有 layout='cards'（日程分頁）會用到：
  // controlsPortalEl —「新增日程／搜尋」這排按鈕（連同展開時的搜尋輸入框）改用 createPortal
  // 掛到這個 DOM 節點底下，而不是照舊渲染在原本位置。這個節點由 App() 建立、放在日曆上方，
  // 讓按鈕實際顯示的位置能挪到日曆之上，同時按鈕本身的狀態（showForm／searchOpen／
  // searchQuery……）完全不用搬家，還是留在 TimelineSection 內部，只是渲染輸出的落點不同。
  // rangeFilter — 日曆目前顯示的時間範圍｛mode:'month'|'year', year, month?｝，由
  // AnniversaryCalendar 算出、透過 App() 往下傳，日程卡片列表依這個範圍重新計算要顯示哪些事件
  // （見下方 rangedEvents）。
  // showAll —「展示全部事件」開關目前的狀態，同樣由 App() 持有（放在按鈕列跟日曆之間，
  // 不是這個元件自己的內部狀態）。關閉（預設）＝只列出 rangeFilter 範圍內（本月／該年）的事件；
  // 開啟＝忽略日曆目前選的範圍，直接列出全部事件（跟 processedEvents 同一份排序結果）。
  controlsPortalEl = null,
  rangeFilter = null,
  showAll = false,
}) {
  const isCardsLayout = layout === 'cards';
  const [showForm, setShowForm] = useState(false);
  // 新增／編輯地標視窗的顯示階段：保留 mounted 狀態直到關閉動畫完成，
  // 這樣視窗不會在關閉瞬間消失。
  const [formPhase, setFormPhase] = useState('hidden'); // hidden -> enter -> shown -> closing
  // 原本 60ms 太短：整段伸縮動畫只夠瀏覽器畫 3～4 幀，肉眼看起來像「跳」而不是「動」。
  // 拉長到 220ms，讓 opacity／transform 有足夠的幀數可以插值，動畫才會感覺平滑。
  // 時間拉長並不會拖慢「彈出反應」——按下按鈕到動畫開始播放的延遲沒變，
  // 變長的只是動畫播放本身的時間，兩者是分開的事。
  const FORM_MODAL_DURATION = 220;
  function openForm() {
    setShowForm(true);
    setFormPhase('enter');
    requestAnimationFrame(() => setFormPhase('shown'));
  }
  function closeForm() {
    if (!showForm || formPhase === 'closing') return;
    setFormPhase('closing');
    setTimeout(() => {
      setShowForm(false);
      resetForm();
      setFormPhase('hidden');
    }, FORM_MODAL_DURATION);
  }
  useModalBackClose(showForm, closeForm);
  // 刪除地標前的二次確認：存的是「待刪除」那筆事件的 id，不是布林值，
  // 這樣彈窗裡才能顯示出具體是哪一筆（標題），跟帳號那邊「刪除帳號」用的是同一套風格
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteModalPhase, setDeleteModalPhase] = useState('hidden');
  const DELETE_MODAL_DURATION = 55;
  function openDeleteConfirm(id) {
    setConfirmDeleteId(id);
    setDeleteModalPhase('enter');
    requestAnimationFrame(() => setDeleteModalPhase('shown'));
  }
  function closeDeleteConfirm() {
    if (deleteModalPhase === 'closing') return;
    setDeleteModalPhase('closing');
    setTimeout(() => {
      setConfirmDeleteId(null);
      setDeleteModalPhase('hidden');
    }, DELETE_MODAL_DURATION);
  }
  useModalBackClose(!!confirmDeleteId, closeDeleteConfirm);
  // 相冊功能已經獨立成一級功能（見 AlbumsFeature／App 內的 albumRoute），這裡的「相冊」按鈕
  // 只負責呼叫 onOpenAlbumForEvent(id) 交給上層決定要開啟哪個相冊／進入建立流程，
  // 時間軸本身不再持有任何相冊/相片狀態。
  // 「新增地標」視窗的伸縮動畫改成跟「地標詳情」卡片裡的「自訂」二級面板同一套做法：
  // 不再用 JS（ResizeObserver）即時量測整份表單的實際高度、包一層算出來的像素值做 height
  // transition——量測跟 CSS 動畫是兩條不同步的時間軸，量測結果會在動畫播放途中一路變動、
  // 反覆回灌新的目標值給外層動畫追，兩邊互相打架，這才是先前伸縮看起來卡頓、抖動的根本原因。
  // 現在改成每個真正會展開/收合的區塊（模式相關的「循環」欄位、「重複」子欄位、圖示子選單、
  // 自訂圖示輸入列……）各自固定掛載、用足夠寬裕但固定的 maxHeight／opacity 做純 CSS transition，
  // 不必精準對到內容實際高度，只要蓋得住即可；外層容器本身完全不用另外做動畫，
  // 直接讓瀏覽器原生 reflow 跟著各個子區塊的 CSS 動畫自然撐開/收合，跟事件詳情卡片一樣順。
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);
  const [openIconSubmenu, setOpenIconSubmenu] = useState(null); // 目前展開子菜單的母菜單 key
  const [showCustomIconPanel, setShowCustomIconPanel] = useState(false);
  const [customIconInput, setCustomIconInput] = useState('');
  const [customIconError, setCustomIconError] = useState('');
  const [colorId, setColorId] = useState(COLOR_TAGS[0].id);
  const [calendar, setCalendar] = useState('gregory');
  const [repeat, setRepeat] = useState(false);
  const [repeatUnit, setRepeatUnit] = useState('year');
  const [repeatInterval, setRepeatInterval] = useState(1);
  const [isBirthday, setIsBirthday] = useState(false);
  const [isCare, setIsCare] = useState(false);
  // 「模式選擇」目前選中的模式 id（生日／陪伴／關懷／紀念日／常規，見 EVENT_MODES），
  // 取代原本「重複」區塊裡疊在一起的三層開關（重複／生日模式／關懷模式）。
  // isBirthday／isCare 這兩個既有 state 保留不動，繼續驅動圖示清單、顏色清單、灰階濾鏡等
  // 已經寫好的邏輯，只是現在改由 selectMode 統一設定，不再各自獨立切換。
  const [eventMode, setEventMode] = useState('regular');
  const [careCustomIcon, setCareCustomIcon] = useState(null); // 關懷模式第三格「自選」圖示，是單一一格、跟平常的自訂圖示清單分開
  // 開啟關懷模式時暫存原本選的圖示／顏色，關掉時還原，避免使用者原本選好的東西憑空消失
  const prevIconRef = useRef(ICONS[0]);
  const prevColorRef = useRef(COLOR_TAGS[0].id);
  // 切換「模式選擇」的五個選項：生日／關懷兩個模式互斥，且各自對應原本的圖示與顏色切換規則
  // （進入關懷模式換成蠟燭／墓碑等素雅組合，離開時還原成切換前的圖示與顏色）；
  // 生日模式沿用「固定每年重複一次」的既有邏輯，改成由模式直接決定 repeat／repeatUnit／repeatInterval，
  // 不用另外操作重複開關。「陪伴」「紀念日」「常規」三個新選項目前只記錄選中的模式本身、不重複，
  // 具體行為之後再依安排補上。
  function selectMode(modeId) {
    const nextIsCare = modeId === 'care';
    if (nextIsCare && !isCare) {
      prevIconRef.current = icon;
      prevColorRef.current = colorId;
      setIcon(CARE_ICONS[0]);
      setColorId(CARE_COLOR_TAGS[0].id);
    } else if (!nextIsCare && isCare) {
      setIcon(prevIconRef.current);
      setColorId(prevColorRef.current);
    }
    setIsCare(nextIsCare);
    setIsBirthday(modeId === 'birthday');
    if (modeId === 'birthday' || modeId === 'care') {
      setRepeat(true);
      setRepeatUnit('year');
      setRepeatInterval(1);
    } else if (modeId === 'companion') {
      setRepeat(false);
      setRepeatUnit('year');
      setRepeatInterval(1);
    }
    setEventMode(modeId);
  }
  const [formSession, setFormSession] = useState(0);
  const [showPast, setShowPast] = useState(false); // 過去的地標預設收合，讓最近的未來地標永遠排在第一個
  const [searchOpen, setSearchOpen] = useState(false);
  // 目前開啟「地標詳情」視窗的事件 id：改由上層 App 持有／傳入（見 App 內的 viewingId／setViewingId），
  // 而不是這裡自己 useState——大屏分欄模式下，這個視窗不再是蓋在畫面正中央的彈窗，
  // 而是要嵌進右側面板顯示，且時間軸本身也要挪到左側，這些都需要 App 知道「目前有沒有正在看哪個地標」。
  const [searchQuery, setSearchQuery] = useState('');
  const listRef = useRef(null); // 時間軸清單自己的捲動容器（獨立於整頁）

  // 只有在「新增地標」視窗開著、且使用者勾選了「關懷模式」時，才把畫面變成素雅樣式，
  // 用意是紀念／追悼情境下讓介面呈現素雅一點；一般情況（包含表單開著但沒開關懷模式）維持原本色彩。
  // 素雅樣式套用在 header 跟世界時鐘整個區塊（含次要時區清單、按鈕、卡片邊框等），
  // 做法是覆寫這兩個區塊的 --ink／--ink-soft／--card-bg／--card-border／--accent 這幾個
  // CSS 變數（見 CARE_MODE_VARS），而不是套用 `filter: grayscale()`。
  // 這兩種做法的差別，也是刻意不用 filter 的原因：filter 是對整個 DOM 子樹做像素等級的
  // 去色，子元素沒辦法自己「跳出」祖先的濾鏡；國旗 emoji 本來就不是靠這些 CSS 變數上色的內容，
  // 濾鏡卻會不分青紅皂白把它一起變灰。改成只覆寫 token 之後，國旗完全不受影響，
  // 停留在原本的 DOM 位置就好，不需要任何額外處理，也不需要 portal。
  // 時間軸則刻意排除在素雅範圍之外——地標本身的顏色標籤是使用者自己設定的內容，
  // 開啟關懷模式只是在「填表單」這件事上營造素雅氣氛，不應該連帶影響其他既有地標的顏色。
  // 視窗本身用 createPortal 掛在 document.body 底下，也不在這個範圍裡，所以同樣不受影響。
  useEffect(() => {
    const headerEl = document.querySelector('header');
    const worldClockEl = document.getElementById('world-clock-section-root');
    const targets = [headerEl, worldClockEl].filter(Boolean);
    const shouldCare = showForm && isCare;
    targets.forEach(el => {
      Object.entries(CARE_MODE_VARS).forEach(([key, value]) => {
        if (shouldCare) el.style.setProperty(key, value);
        else el.style.removeProperty(key);
      });
    });
    return () => {
      targets.forEach(el => {
        Object.keys(CARE_MODE_VARS).forEach(key => el.style.removeProperty(key));
      });
    };
  }, [showForm, isCare]);

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setDate('');
    setIcon(ICONS[0]);
    setOpenIconSubmenu(null);
    setShowCustomIconPanel(false);
    setCustomIconInput('');
    setCustomIconError('');
    setColorId(COLOR_TAGS[0].id);
    setCalendar('gregory');
    setRepeat(false);
    setRepeatUnit('year');
    setRepeatInterval(1);
    setIsBirthday(false);
    setIsCare(false);
    setEventMode('regular');
    setCareCustomIcon(null);
  }

  function toggleForm() {
    if (showForm) {
      closeForm();
    } else {
      setFormSession(s => s + 1);
      openForm();
    }
  }

  // Shift+C 快速呼出「新增地標」表單：
  // 只在「目前沒有選取文字、也沒有把焦點放在輸入框／可編輯區塊」時才攔截。
  // 不再攔截 Ctrl+C / Cmd+C，避免影響系統原生複製功能。
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key !== 'c' && e.key !== 'C') return;
      if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target;
      const isEditable = target && (
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      );
      if (isEditable) return;
      const selection = typeof window !== 'undefined' ? window.getSelection() : null;
      if (selection && selection.toString().length > 0) return; // 使用者正要複製選取的文字，不攔截
      if (showForm) return; // 表單已經開著（新增或編輯中），不重複處理
      e.preventDefault();
      setFormSession(s => s + 1);
      openForm();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showForm]);

  function startEdit(ev) {
    setEditingId(ev.id);
    setTitle(ev.title);
    setDate(ev.date);
    setIcon(ev.icon);
    setOpenIconSubmenu(null);
    setColorId(ev.colorId);
    setCalendar(ev.calendar || 'gregory');
    setRepeat(!!ev.repeat);
    setRepeatUnit(ev.repeatUnit || 'year');
    setRepeatInterval(ev.repeatInterval || 1);
    setIsBirthday(!!ev.isBirthday);
    setIsCare(!!ev.isCare);
    // 換算目前選中的模式：優先看資料本身有沒有存 mode 欄位（新資料）；沒有的話（這一版之前建立的
    // 舊地標）就照 isBirthday／isCare 反推，兩者都沒設定就一律算「常規」。
    const mode = eventModeFromEv(ev);
    setEventMode(mode);
    if (mode === 'birthday' || mode === 'care') {
      setRepeat(true); setRepeatUnit('year'); setRepeatInterval(1);
    } else if (mode === 'companion') {
      setRepeat(false); setRepeatUnit('year'); setRepeatInterval(1);
    }
    setCareCustomIcon(ev.careCustomIcon || null);
    setFormSession(s => s + 1);
    openForm();
  }

  function handleAddCustomIcon() {
    const value = customIconInput.trim();
    if (!value) return;
    if (customIcons.includes(value)) {
      // 已存在的自訂 emoji，直接選用即可
      setIcon(value);
      setOpenIconSubmenu(null);
      setCustomIconInput('');
      setCustomIconError('');
      return;
    }
    if (customIcons.length >= 30) {
      setCustomIconError(t.customIconLimit);
      return;
    }
    setCustomIcons(prev => [...prev, value]);
    setIcon(value);
    setOpenIconSubmenu(null);
    setCustomIconInput('');
    setCustomIconError('');
  }

  // 關懷模式專用：只維護「一格」自選圖示，不像平常的自訂圖示會一直往清單裡加
  function handleSetCareCustomIcon() {
    const value = customIconInput.trim();
    if (!value) return;
    setCareCustomIcon(value);
    setIcon(value);
    setShowCustomIconPanel(false);
    setCustomIconInput('');
    setCustomIconError('');
  }

  function handleRemoveCustomIcon(value) {
    setCustomIcons(prev => prev.filter(v => v !== value));
  }

  function handleAdd() {
    if (!title || !date) {
      alert(t.fillRequired);
      return;
    }
    const eventData = {
      title,
      date,
      time: '',
      icon,
      colorId,
      calendar,
      repeat: eventMode === 'birthday' || eventMode === 'care' ? true : eventMode === 'companion' ? false : repeat,
      repeatUnit: calendar !== 'gregory' ? 'year' : repeatUnit,
      repeatInterval: eventMode === 'birthday' || eventMode === 'care' ? 1 : Math.max(1, parseInt(repeatInterval) || 1),
      isBirthday: eventMode === 'birthday',
      isCare,
      careCustomIcon: isCare ? careCustomIcon : null,
      // 「模式選擇」選中的模式 id（生日／陪伴／關懷／紀念日／常規）。isBirthday／isCare 兩個既有欄位
      // 繼續保留，讓已經寫好的圖示切換／徽章顯示等邏輯不用跟著改；mode 是額外多存一份，方便之後
      // 「陪伴」「紀念日」這兩個新模式各自要做的具體行為有地方可以掛。
      mode: eventMode,
    };
    if (editingId) {
      setEvents(prev => prev.map(e => (e.id === editingId ? { ...e, ...eventData } : e)));
    } else {
      setEvents(prev => [...prev, { id: Date.now().toString(), ...eventData }]);
    }
    closeForm();
  }

  function deleteEvent(id) {
    setEvents(prev => prev.filter(e => e.id !== id));
    if (editingId === id) { closeForm(); }
  }

  // 「地標詳情」視窗裡上傳／移除自訂卡片背景，直接存進對應事件的 bgImage 欄位，
  // 沿用既有的 events -> window.storage 自動儲存機制，不用另外處理持久化
  function setEventBgImage(id, dataUrlOrNull) {
    setEvents(prev => prev.map(e => (e.id === id ? { ...e, bgImage: dataUrlOrNull } : e)));
  }

  // 「地標詳情」視窗裡調整自訂背景的透明遮罩不透明度（0～1）。
  // 注意：這裡只控制遮罩，卡片的 backdrop-filter blur 保持固定，不受滑桿影響。
  function setEventBgOpacity(id, opacity) {
    setEvents(prev => prev.map(e => (e.id === id ? { ...e, bgOverlayOpacity: opacity } : e)));
  }

  // 「地標詳情」視窗裡切換大數字的字體，存進事件的 numberFont 欄位（存字體 id，不存字型本身）
  function setEventNumberFont(id, fontId) {
    setEvents(prev => prev.map(e => (e.id === id ? { ...e, numberFont: fontId } : e)));
  }

  // 計算每個事件的有效日期與差異天數
  // 包進 useMemo：只有 events／now 真的變動時才重算，避免元件因為其他無關的 local state
  // （例如打字搜尋、開關表單）重新渲染時，跟著白白重算一次全部事件（見「日程頁操作反應慢」）。
  const processedEvents = useMemo(() => {
    return events.map(ev => {
      const targetDate = getEffectiveDate(ev, now);
      // 簡單的天數計算（忽略時分秒的精確度，以本地日期為基準）
      const targetTime = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
      const todayTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const diffDays = Math.ceil((targetTime - todayTime) / (1000 * 60 * 60 * 24));

      // 生日／關懷模式：以原始日期為起點，計算本次週年所對應的年數。
      let age = null;
      if ((ev.isBirthday || ev.isCare) && ev.repeat) {
        const origDate = combineDateTime(ev.date, ev.time);
        age = Math.max(0, targetDate.getFullYear() - origDate.getFullYear());
      }
      // 陪伴模式不循環，中央數字改為「從開始日期至今」的累積天數。
      const origDateOnly = new Date(`${ev.date}T00:00:00`);
      const elapsedDays = Math.floor((todayTime - origDateOnly.getTime()) / (1000 * 60 * 60 * 24));

      return { ...ev, targetDate, diffDays, age, elapsedDays };
    }).sort((a, b) => a.diffDays - b.diffDays);
  }, [events, now]);

  // 目前開啟「地標詳情」視窗所對應的事件（含算好的 targetDate/diffDays/age），
  // 從 processedEvents 現查而不是另外存一份快照，這樣視窗開著時倒數天數等資訊會隨 now 自然更新
  const viewingEvent = viewingId ? processedEvents.find(e => e.id === viewingId) || null : null;
  // 待刪除確認的那一筆地標（用來在確認彈窗裡顯示標題），刪除後 events 就沒有這筆了，
  // 這裡從 processedEvents 找不到時視為已不存在，順手把確認彈窗收起來即可
  const confirmDeleteEvent = confirmDeleteId ? processedEvents.find(e => e.id === confirmDeleteId) || null : null;
  // 目前開啟「相冊」視窗所對應的事件，同樣從 processedEvents 現查（拿到的是含 albums 欄位的完整事件）

  // 已經過去（diffDays < 0）的地標一律歸進上方可收合的區塊，預設收合，
  // 這樣不論未來地標有幾筆（即使只有一筆），開啟頁面時第一眼看到的永遠是它，不必再手動下滑
  // （這份 pastEvents／upcomingEvents 只給 layout='timeline'（時光線分頁）用；
  // cards 模式（日程分頁）改用下面的 rangedEvents，跟著日曆目前選的月份／年份走，見需求六）
  const pastEvents = processedEvents.filter(ev => ev.diffDays < 0);
  const upcomingEvents = processedEvents.filter(ev => ev.diffDays >= 0);

  // cards 模式（日程分頁）專用：依日曆目前選擇的時間範圍（月或年），重新算出落在該範圍內的
  // 事件發生日——這跟 processedEvents 在算的「這個事件最近一次會發生在什麼時候」不是同一件事
  // （使用者在日曆上翻到過去或未來的月份／年份時，兩者給出的日期可能不同），所以另外算一份，
  // 不去動 processedEvents 原本的邏輯與用途（時間軸分頁、編輯/刪除/相冊彈窗依然完全依賴它）。
  // 年檢視需要逐月掃描 12 次，才能抓到「每個月各自最近一次落在那個月裡的發生日」——例如每月
  // 重複的事件，一整年應該出現 12 次，不是只出現一次。
  // 「展示全部事件」開啟時（showAll），不分月份／年份，直接沿用 upcomingEvents（每個事件
  // 最近一次發生日、已經照日期排序好，只保留還沒過去的），不用再逐月掃描一次。
  // 日程分頁不論「展示全部事件」開關或選到哪個月份／年份，一律不列出已經過去（diffDays < 0）
  // 的地標本身——不只是把它們收進可收合區塊而已，是整個不出現在卡片列表裡（見使用者需求：
  // 日程分頁不要顯示「往日地標」的內容，不只是那個收合按鈕/區塊）。
  // 同樣包進 useMemo：這一份對農曆／其他曆法事件來說本來就不便宜（getEffectiveDate 內部要
  // 逐日掃描比對），年檢視還要乘以 12 個月，如果不快取，父層 App 每 30 秒跳一次「現在時間」、
  // 或是在這個分頁打字搜尋、開合新增表單，都會讓它重新整個算一次，正是先前「開啟日程頁卡頓、
  // 操作反應慢」的主因——改成只有 events／rangeFilter／showAll／now 真的變動時才重算。
  const rangedEvents = useMemo(() => {
    if (!isCardsLayout) return [];
    if (showAll) return upcomingEvents;
    if (!rangeFilter) return [];
    const todayTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const results = [];
    // 加進 results 前共用的整理步驟（算 diffDays／age／elapsedDays、組 __occKey），
    // 三種掃描方式（逐月／一年一次／週區間）都要用到，抽出來避免重複程式碼。
    function pushOccurrence(ev, occ) {
      const targetTime = new Date(occ.getFullYear(), occ.getMonth(), occ.getDate()).getTime();
      const diffDays = Math.ceil((targetTime - todayTime) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) return; // 日程分頁不列出已經過去的地標，直接跳過，不進 results
      let age = null;
      if ((ev.isBirthday || ev.isCare) && ev.repeat) {
        const origDate = combineDateTime(ev.date, ev.time);
        age = Math.max(0, occ.getFullYear() - origDate.getFullYear());
      }
      const origDateOnly = new Date(`${ev.date}T00:00:00`);
      const elapsedDays = Math.floor((todayTime - origDateOnly.getTime()) / (1000 * 60 * 60 * 24));
      // 同一筆事件在年檢視底下可能一年出現好幾次（例如每月重複），key 不能只用 ev.id，
      // 另外帶上發生日期時間戳記做成 __occKey，渲染卡片時才不會撞 key。
      results.push({ ...ev, targetDate: occ, diffDays, age, elapsedDays, __occKey: `${ev.id}::${occ.getTime()}` });
    }
    // 週檢視：改用通用的日期區間比對（見 getEventOccurrencesInRange 開頭註解），一週最多
    // 橫跨兩個西曆月份／年份，不能沿用下面「按月份／按年份」的掃描方式。
    if (rangeFilter.mode === 'week') {
      if (rangeFilter.weekStart && rangeFilter.weekEnd) {
        getEventOccurrencesInRange(events, rangeFilter.weekStart, rangeFilter.weekEnd)
          .forEach(({ ev, occ }) => pushOccurrence(ev, occ));
      }
      results.sort((a, b) => a.targetDate - b.targetDate);
      return results;
    }
    const monthsToScan = rangeFilter.mode === 'year'
      ? Array.from({ length: 12 }, (_, m) => m)
      : [rangeFilter.month];
    events.forEach(ev => {
      // 「每 N 個月」重複（只有西曆才會這樣設定）一年可能出現好幾次，必須逐月各自算一次；
      // 西曆的月份比較是精確的日期大小比較，不會有下面「年重複」那種區塊搜尋誤判的問題，
      // 繼續維持原本逐月重算即可。
      if (ev.repeat && ev.repeatUnit === 'month') {
        monthsToScan.forEach(m => {
          const ref = new Date(rangeFilter.year, m, 1);
          const occ = getEffectiveDate(ev, ref);
          if (occ.getFullYear() !== rangeFilter.year || occ.getMonth() !== m) return;
          pushOccurrence(ev, occ);
        });
        return;
      }
      // 不循環的固定日期、或年重複（含農曆／伊斯蘭曆／希伯來曆等，以及生日／關懷模式）：
      // 一年最多只會發生一次，用「目標年份 1 月 1 號」當基準往未來掃描一次即可，
      // 不要對 12 個月各自重算——見 getYearlyOccurrenceInYear 開頭註解，這正是修復「同一個
      // 年重複事件被誤判成出現在兩個連續月份」的關鍵。
      const occ = getYearlyOccurrenceInYear(ev, rangeFilter.year);
      if (occ.getFullYear() !== rangeFilter.year) return;
      if (rangeFilter.mode === 'month' && occ.getMonth() !== rangeFilter.month) return;
      pushOccurrence(ev, occ);
    });
    results.sort((a, b) => a.targetDate - b.targetDate);
    return results;
  }, [isCardsLayout, rangeFilter, events, now, showAll, upcomingEvents]);

  // 搜尋：輸入關鍵字時，直接在全部地標（不分過去／未來）中比對標題，跳出原本的分區顯示
  const searchQueryNormalized = searchQuery.trim().toLowerCase();
  const isSearching = searchQueryNormalized.length > 0;
  const searchResults = isSearching
    ? processedEvents.filter(ev => ev.title.toLowerCase().includes(searchQueryNormalized))
    : null;

  function renderEventCard(ev) {
    const cardInner = (
      <div
        className="p-4 rounded-2xl relative group cursor-pointer"
        style={{
          ...glass(ev.id === editingId ? { border: `1.5px solid ${ACCENT}` } : {}),
          position: 'relative',
          zIndex: 1,
        }}
        onClick={() => setViewingId(ev.id)}
      >
        <div className="flex justify-between items-start mb-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">{ev.icon}</span>
            <h3 className="font-bold text-lg" style={{ color: INK }}>{ev.title}</h3>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={e => { e.stopPropagation(); onOpenAlbumForEvent && onOpenAlbumForEvent(ev.id); }} aria-label={t.album} title={t.album} className="p-2 rounded-lg transition-colors" style={{ color: INK_SOFT }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--card-border)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <Images size={15} />
            </button>
            <button onClick={e => { e.stopPropagation(); startEdit(ev); }} aria-label={t.edit} className="p-2 rounded-lg transition-colors" style={{ color: INK_SOFT }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--card-border)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <Pencil size={15} />
            </button>
            <button onClick={e => { e.stopPropagation(); openDeleteConfirm(ev.id); }} aria-label={t.delete} className="p-2 rounded-lg transition-colors" style={{ color: DANGER }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,0,74,0.14)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="text-sm font-medium mb-1 flex items-center gap-2 flex-wrap" style={{ color: INK_SOFT }}>
          <span>{ev.targetDate.toLocaleDateString(LOCALE_MAP[lang])}</span>
          {ev.repeat && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: 'var(--card-border)', color: INK_SOFT }}>
              {ev.repeatUnit === 'month' ? t.monthlyBadge(ev.repeatInterval) : t.yearlyBadge(ev.repeatInterval)}
            </span>
          )}
        </div>
        {ev.calendar && ev.calendar !== 'gregory' && (
          <div className="text-xs font-medium mb-2" style={{ color: ACCENT }}>
            {formatAltCalendar(ev.targetDate, ev.calendar, lang, t)}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-block px-3 py-1 rounded-lg text-sm font-bold" style={{ background: `${colorHex(ev.colorId)}20`, color: colorHex(ev.colorId) }}>
            {ev.mode === 'companion'
              ? t.companionDays(Math.max(0, ev.elapsedDays ?? 0))
              : ev.diffDays === 0 ? t.today : ev.diffDays > 0 ? t.daysLeft(ev.diffDays) : t.daysAgo(Math.abs(ev.diffDays))}
          </div>
          {ev.age !== null && (
            <div className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-bold" style={{ background: `${colorHex(ev.colorId)}20`, color: colorHex(ev.colorId) }}>
              {ev.isCare ? t.anniversaryBadge(ev.age) : t.ageBadge(ev.age)}
            </div>
          )}
        </div>
      </div>
    );

    // cards 模式（日程分頁）：不畫時間軸圓點跟連接線，卡片本身內容一模一樣，只是拿掉外層
    // 那個 `pl-6` + 絕對定位圓點的包裝。timeline 模式（時光線分頁）完全維持原樣。
    // key 優先用 __occKey（rangedEvents 年檢視底下，同一筆事件可能一年出現好幾次，
    // 只用 ev.id 會撞 key）；沒有 __occKey 時（例如搜尋結果，來自 processedEvents）退回用 ev.id。
    if (isCardsLayout) {
      return <div key={ev.__occKey || ev.id}>{cardInner}</div>;
    }
    return (
      <div key={ev.__occKey || ev.id} className="relative pl-6" style={{ zIndex: 10 }}>
        {/* 圓點指示器：整個事件項目建立獨立堆疊層，圓點永遠位於時間軸線與卡片之上。
            left／top 用 rem 而非寫死 px，縮放時才會跟軸線同步移動、保持對齊。
            拿掉了原本 boxShadow 最外層跟背景同色的那圈（0 0 0 2px var(--page-bg)），
            那圈視覺上太粗，看起來像把軸線整個截斷；只留 border 的 page-bg 圈（讓圓點跟
            軸線之間有一圈鏤空分隔）跟 boxShadow 內層的 card-border 細圈（輪廓）。 */}
        <div
          className="absolute w-4 h-4 rounded-full"
          style={{
            background: colorHex(ev.colorId),
            left: '-1.375rem',
            top: '0.25rem',
            border: '0.1875rem solid var(--page-bg)',
            boxShadow: '0 0 0 0.0625rem var(--card-border)',
            zIndex: 20,
            pointerEvents: 'none',
          }}
        />
        {cardInner}
      </div>
    );
  }

  // 「新增日程／搜尋」這排按鈕（含展開時的搜尋輸入框）：timeline 模式（時光線分頁）維持原本
  // 位置，固定在清單最上方、可拖曳收合世界時鐘。cards 模式（日程分頁）改成透過 createPortal
  // 掛到 controlsPortalEl（App() 裡放在日曆上方的一個節點），視覺上讓這排按鈕出現在日曆
  // 上方，而不是這個元件實際掛載的地方（日曆下方、清單的捲動容器裡）——按鈕本身的狀態、
  // 點擊行為完全沒變，只是渲染輸出的落點不同。
  const headerControls = (
    <div className="flex-shrink-0">
      <div
        className="flex items-center justify-between select-none"
        style={{
          ...(isCardsLayout ? undefined : { cursor: 'ns-resize', touchAction: 'none' }),
          // cards 模式（日程分頁）：這排按鈕現在透過 portal 掛在日曆上方，外層的 flex 容器
          // 本身已經用 gap 在管理跟下一個元素（日曆）之間的距離，這裡不再額外加 mb-3，
          // 避免兩邊間距疊加，日程頁最上面看起來留白過多（見「頁面上部分留白過多」）。
          // 只有展開搜尋輸入框時才需要在按鈕列跟輸入框之間留一點內部間距。
          marginBottom: isCardsLayout ? (searchOpen ? 12 : 0) : 12,
        }}
        onPointerDown={e => {
          if (isCardsLayout) return; // cards 模式（日程分頁）沒有可拖曳收合的世界時鐘在上面，這個手勢用不到
          if (e.target.closest('button')) return; // 標題列右側的按鈕不應觸發拖曳
          e.currentTarget.setPointerCapture(e.pointerId);
          onHeaderDragStart && onHeaderDragStart(e.clientY);
        }}
        onPointerMove={e => { if (!isCardsLayout && e.buttons === 1) onHeaderDragMove && onHeaderDragMove(e.clientY); }}
        onPointerUp={() => !isCardsLayout && onHeaderDragEnd && onHeaderDragEnd()}
        onPointerCancel={() => !isCardsLayout && onHeaderDragEnd && onHeaderDragEnd()}
      >
        {/* cards 模式（日程分頁）不再重複顯示「時間軸」這個標題文字——頁面最上面已經有
            「日程」這個頁面標題了（見 App() 裡的頁面標題邏輯），這裡留空只保留右側的
            搜尋／新增按鈕，避免同一個畫面出現兩個標題疊在一起。 */}
        <div className="flex items-center gap-2">
          {!isCardsLayout && (
            <>
              <MapPin size="1.125rem" style={{ color: MINT }} />
              <h2 className="font-bold" style={{ color: INK, fontSize: '1.125rem' }}>{t.timeline}</h2>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(v => { const next = !v; if (!next) setSearchQuery(''); return next; })}
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{ ...glass(), width: '1.875rem', height: '1.875rem', color: searchOpen ? MINT : INK }}
          >
            <Search size={14} />
          </button>
          {/* 「每日一籤」：只在日程分頁（cards 模式）出現，放在搜尋跟新增日程中間，點下去
              直接跳轉到外部的每日一籤網頁。用 window.open 開新分頁而不是原地導頁，這樣使用者
              看完籤詩回來時，日程頁原本的捲動位置、搜尋關鍵字都還在，不會被導頁清空。 */}
          {isCardsLayout && (
            <button
              onClick={() => window.open('https://timezzw.top/DFortune', '_blank', 'noopener,noreferrer')}
              className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg font-medium flex-shrink-0"
              style={{ background: '#C23B34', color: '#fff' }}
            >
              {t.dailyFortuneLabel}
            </button>
          )}
          <button 
            onClick={toggleForm}
            className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg font-medium" 
            style={{ background: showForm ? INK_SOFT : MINT, color: '#fff' }}
          >
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? t.cancel : (isCardsLayout ? t.addSchedule : t.newLandmark)}
          </button>
        </div>
      </div>
      {searchOpen && (
        <div className={isCardsLayout ? 'relative' : 'relative mb-3'}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: INK_SOFT, pointerEvents: 'none' }} />
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{ border: CARD_BORDER, background: INPUT_BG, color: INK }}
          />
        </div>
      )}
    </div>
  );

  return (
    <div id="timeline-section-root" className="flex-1 min-h-0 flex flex-col">
      {/* timeline 模式：跟以前一樣就地渲染在清單最上方。cards 模式：只有在 App() 已經把
          portal 目標節點準備好（controlsPortalEl 不是 null）才渲染，避免節點還沒掛載前
          按鈕先短暫出現在錯的位置（日曆下方）又跳走。 */}
      {isCardsLayout
        ? (controlsPortalEl ? createPortal(headerControls, controlsPortalEl) : null)
        : headerControls}

      {/* 事件列表：獨立的捲動容器。timeline 模式（時光線分頁）維持原本的軸線＋往日地標收合區塊；
          cards 模式（日程分頁）只保留卡片本身，不畫軸線、不顯示「往日地標」這個區塊，改用
          rangedEvents（跟著日曆目前選的月份／年份、以及「只展示未來代辦事件」開關）。 */}
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto pb-6">
        {isSearching ? (
          searchResults.length === 0 ? (
            <div className="py-8 pl-4">
              <p style={{ color: INK, fontWeight: 'bold' }}>{t.noSearchResults}</p>
            </div>
          ) : (
            <div
              className={isCardsLayout ? 'flex flex-col' : 'relative pl-4 border-l-2 ml-2 flex flex-col'}
              style={isCardsLayout ? { gap: EVENT_CARD_GAP } : { borderColor: '#000', zIndex: 0, gap: EVENT_CARD_GAP }}
            >
              {searchResults.map(renderEventCard)}
            </div>
          )
        ) : isCardsLayout ? (
          // cards 模式：不畫軸線、不顯示「往日地標」收合區塊，只列出目前日曆時間範圍內、
          // 符合「只展示未來代辦事件」開關設定的事件卡片（見 rangedEvents）。
          rangedEvents.length > 0 ? (
            <div className="flex flex-col" style={{ gap: EVENT_CARD_GAP }}>
              {rangedEvents.map(renderEventCard)}
            </div>
          ) : (
            <div className="py-8">
              <p style={{ color: INK, fontWeight: 'bold' }}>
                {rangeFilter && rangeFilter.mode === 'year' ? t.emptyScheduleYear
                  : rangeFilter && rangeFilter.mode === 'week' ? t.emptyScheduleWeek
                  : t.emptyScheduleMonth}
              </p>
              <p className="text-sm mt-1" style={{ color: INK_SOFT }}>{t.emptyTimelineSub}</p>
            </div>
          )
        ) : processedEvents.length === 0 ? (
          <div className="py-8 pl-4">
            <p style={{ color: INK, fontWeight: 'bold' }}>{t.emptyTimeline}</p>
            <p className="text-sm mt-1" style={{ color: INK_SOFT }}>{t.emptyTimelineSub}</p>
          </div>
        ) : (
          <div className="relative pl-4 ml-2" style={{ zIndex: 0 }}>
            {/* 單一貫穿到底的軸線：改用一條絕對定位的線條元素，從收合按鈕最上面一路畫到
                最後一筆未來地標，取代原本「收合按鈕上方沒有畫線」「過去／未來兩個區塊各自用
                border-l-2 畫一段、中間留白」的做法，避免軸線在按鈕與兩個區塊交界處斷開。 */}
            <div
              aria-hidden="true"
              className="absolute"
              style={{ left: 0, top: 0, bottom: 0, width: 2, background: '#000', pointerEvents: 'none' }}
            />
            {/* 已經過去的地標：獨立收合區塊，預設收合，永遠排在最上面，不佔用未來地標的版面 */}
            {pastEvents.length > 0 && (
              <button
                onClick={() => setShowPast(v => !v)}
                className="w-full flex items-center gap-2 px-2 py-2 mb-2 rounded-lg text-sm font-medium"
                style={{
                  color: INK_SOFT,
                  transition: 'color 120ms ease',
                }}
              >
                <ChevronDown
                  size={14}
                  style={{
                    // 收合時箭頭朝左；展開時逆時針旋轉 90°，箭頭朝下。
                    transform: showPast ? 'rotate(0deg)' : 'rotate(90deg)',
                    transition: 'transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                    willChange: 'transform',
                    flexShrink: 0,
                  }}
                />
                {t.pastLandmarks(pastEvents.length)}
              </button>
            )}
            {pastEvents.length > 0 && (
              <PastEventsAnimatedSection
                show={showPast}
                events={pastEvents}
                renderEventCard={renderEventCard}
              />
            )}
            {/* 未來（含今天）的地標：永遠是這個容器打開時第一眼看到的內容 */}
            {upcomingEvents.length > 0 && (
              <div className="relative flex flex-col" style={{ gap: EVENT_CARD_GAP }}>
                {upcomingEvents.map(renderEventCard)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 新增／編輯地標：改成置中的窗口（毛玻璃質感，沿用帳號登入視窗同一套 AUTH_GLASS 樣式），
          不論時間軸目前捲到哪裡，開啟表單都直接疊在畫面正中央，不用再手動捲到最上方 */}
      {showForm && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center px-6"
          style={{
            zIndex: 200,
            // 遮罩底色改成固定值，開合只動 opacity：先前讓 background（rgba 顏色本身）跟著
            // opacity 一起變化，等於每一幀都要重繪整個全螢幕遮罩（顏色插值不吃 GPU 合成），
            // 這是彈窗「感覺卡、慢半拍」的主因之一。改成顏色固定、只用 opacity 做淡入淡出，
            // 瀏覽器可以整層丟給合成器處理，不用逐幀重繪。
            background: 'rgba(0,0,0,0.4)',
            opacity: formPhase === 'shown' ? 1 : 0,
            transition: `opacity ${FORM_MODAL_DURATION}ms ease`,
            willChange: 'opacity',
          }}
          onClick={closeForm}
        >
          <div
            className={`w-full ${isLargeScreen ? 'max-w-md' : 'max-w-sm'} max-h-[85vh] overflow-y-auto rounded-2xl p-4`}
            style={{
              ...AUTH_GLASS,
              // 原本 0.4 的透明度太低，毛玻璃模糊再強也擋不住背景的文字色塊透出來，
              // 看起來像半張廢紙蓋在畫面上。改成 0.92（依明暗模式給對應底色），
              // 只留一點點透光感撐住「玻璃」的質地，但底下內容基本上看不穿。
              background: isDark ? 'rgba(29,32,41,0.92)' : 'rgba(255,255,255,0.92)',
              // 「伸縮」的視覺重點是 scale，這裡加回來；但這張卡片本身帶 backdropFilter 模糊，
              // scale 動畫期間若同時開著模糊，瀏覽器每一幀都要照新的尺寸重新取樣背後畫面，
              // 是動畫卡頓的主因。做法改成：只有動畫「靜止」的那一刻（formPhase 為 shown）
              // 才套用模糊，正在伸縮的過程中（enter／closing）先關掉模糊，等尺寸穩定下來
              // 模糊才出現。backdropFilter 本身不做 transition（瀏覽器對它的animate支援
              // 不穩定），切換的瞬間卡片已經接近定格，肉眼幾乎感覺不到「模糊突然出現」，
              // 卻能讓整段伸縮動畫維持在合成器就能處理的 transform／opacity，順暢很多。
              backdropFilter: formPhase === 'shown' ? AUTH_GLASS.backdropFilter : 'none',
              WebkitBackdropFilter: formPhase === 'shown' ? AUTH_GLASS.WebkitBackdropFilter : 'none',
              opacity: formPhase === 'shown' ? 1 : 0,
              transform: formPhase === 'shown' ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.94)',
              transition: `opacity ${FORM_MODAL_DURATION}ms ease, transform ${FORM_MODAL_DURATION}ms cubic-bezier(0.34, 1.28, 0.64, 1)`,
              willChange: 'opacity, transform',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between -mb-1">
                <div className="flex items-center gap-2">
                  {editingId ? <Pencil size={14} style={{ color: ACCENT }} /> : <Plus size={14} style={{ color: MINT }} />}
                  <span className="text-sm font-bold" style={{ color: INK }}>{editingId ? t.editLandmark : (isCardsLayout ? t.addSchedule : t.newLandmark)}</span>
                </div>
                <button onClick={toggleForm} style={{ color: INK_SOFT }}><X size={18} /></button>
              </div>
              <input 
              type="text" placeholder={t.titlePlaceholder} value={title} onChange={e => setTitle(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm w-full outline-none" style={{ border: CARD_BORDER, background: INPUT_BG, color: INK }}
            />
            {/* 曆法：先選擇要用哪一種曆法來輸入日期 */}
            <select
              value={calendar}
              onChange={e => {
                const val = e.target.value;
                setCalendar(val);
                if (val !== 'gregory') setRepeatUnit('year');
              }}
              className="px-3 py-2 rounded-lg text-sm w-full outline-none"
              style={{ border: CARD_BORDER, background: INPUT_BG, color: INK }}
            >
              {CAL_OPTIONS.map(c => (
                <option key={c.id} value={c.id}>{c.label[lang]}</option>
              ))}
            </select>

            {/* 日期：依上面選的曆法顯示對應的日期輸入方式 */}
            {calendar === 'gregory' ? (
              <div className="relative">
                <input
                  type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="px-3 py-2 rounded-lg text-sm w-full outline-none" style={{ border: CARD_BORDER, background: INPUT_BG, color: date ? INK : 'transparent' }}
                />
                {!date && (
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: INK_SOFT }}>
                    {t.datePlaceholder}
                  </span>
                )}
              </div>
            ) : (
              <CalendarDatePicker
                calendarId={calendar}
                isoDate={date}
                onChange={setDate}
                syncKey={formSession}
                lang={lang}
                t={t}
              />
            )}

            <div className="flex flex-col gap-2">
              <div key={isCare ? 'care-icons' : 'normal-icons'} className="flex gap-2 flex-wrap items-center picker-fade-swap">
                {isCare ? (
                  <>
                    {CARE_ICONS.map(i => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setIcon(i)}
                        className="rounded-lg text-xl flex items-center justify-center relative"
                        style={{ ...iconPickStyle(icon === i), width: '2.25rem', height: '2.25rem' }}
                      >
                        {i}
                      </button>
                    ))}
                    {/* 「自選」：關懷模式的第三格，只有一格，點了直接改這一格的內容，不會像平常的自訂圖示一路往下加 */}
                    {careCustomIcon ? (
                      <div className="relative">
                        <button
                          onClick={() => setIcon(careCustomIcon)}
                          className="p-2 rounded-lg text-xl"
                          style={iconPickStyle(icon === careCustomIcon)}
                        >
                          {careCustomIcon}
                        </button>
                        <button
                          onClick={() => { setShowCustomIconPanel(v => !v); setCustomIconError(''); }}
                          aria-label={t.customIconLabel}
                          className="absolute -top-1.5 -right-1.5 rounded-full flex items-center justify-center"
                          style={{ width: 16, height: 16, background: INK_SOFT, color: '#fff' }}
                        >
                          <Pencil size={9} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setShowCustomIconPanel(v => !v); setCustomIconError(''); }}
                        aria-label={t.customIconLabel}
                        className="p-2 rounded-lg text-xl flex items-center justify-center"
                        style={{ ...iconPickStyle(showCustomIconPanel, { border: CARD_BORDER }), width: '2.25rem', height: '2.25rem' }}
                      >
                        <Plus size={16} style={{ color: INK_SOFT }} />
                      </button>
                    )}
                  </>
                ) : (
                  ICONS.map(i => {
                  const hasSubmenu = !!ICON_SUBMENUS[i];
                  // 選取狀態：目前圖示就是母菜單本身，或屬於它旗下的子菜單選項
                  const isSelected = icon === i || (hasSubmenu && ICON_SUBMENUS[i].includes(icon));
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        if (hasSubmenu) {
                          setOpenIconSubmenu(prev => {
                            const willOpen = prev !== i;
                            // 展開子菜單的同時，先預設事件圖示為母菜單本身；
                            // 若之後不在子菜單中選擇，圖示就維持母菜單的內容
                            if (willOpen) setIcon(i);
                            return willOpen ? i : null;
                          });
                        } else {
                          setIcon(i);
                          setOpenIconSubmenu(null);
                        }
                      }}
                      className="p-2 rounded-lg text-xl"
                      style={iconPickStyle(isSelected)}
                    >
                      {i}
                    </button>
                  );
                  })
                )}

                {/* 自訂圖示：與上方的內建 emoji 放在同一區域，使用者自己輸入想用的 emoji，存起來之後可重複選用（僅一般模式；關懷模式改用上面單獨一格的「自選」） */}
                {!isCare && customIcons.map(v => (
                  <div key={v} className="relative">
                    <button
                      onClick={() => { setIcon(v); setOpenIconSubmenu(null); }}
                      className="p-2 rounded-lg text-xl"
                      style={iconPickStyle(icon === v)}
                    >
                      {v}
                    </button>
                    <button
                      onClick={() => handleRemoveCustomIcon(v)}
                      aria-label={t.delete}
                      className="absolute -top-1.5 -right-1.5 rounded-full flex items-center justify-center"
                      style={{ width: 16, height: 16, background: DANGER, color: '#fff' }}
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
                {!isCare && (
                  <button
                    onClick={() => { setShowCustomIconPanel(v => !v); setCustomIconError(''); }}
                    aria-label={t.customIconLabel}
                    className="p-2 rounded-lg text-xl flex items-center justify-center"
                    style={{ ...iconPickStyle(showCustomIconPanel, { border: CARD_BORDER }), width: '2.25rem', height: '2.25rem' }}
                  >
                    <Plus size={16} style={{ color: INK_SOFT }} />
                  </button>
                )}
              </div>
              {!isCare && openIconSubmenu && ICON_SUBMENUS[openIconSubmenu] && (
                <div className="flex gap-2 flex-wrap p-2 rounded-lg" style={{ background: INPUT_BG, border: CARD_BORDER }}>
                  {ICON_SUBMENUS[openIconSubmenu].map(v => (
                    <button
                      key={v}
                      onClick={() => {
                        setIcon(v);
                      }}
                      className="p-2 rounded-lg text-xl"
                      style={iconPickStyle(icon === v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}

              {showCustomIconPanel && (
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={customIconInput}
                    onChange={e => { setCustomIconInput(e.target.value); setCustomIconError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); isCare ? handleSetCareCustomIcon() : handleAddCustomIcon(); } }}
                    placeholder={t.customIconPlaceholder}
                    maxLength={20}
                    className="px-3 py-2 rounded-lg text-lg flex-1 outline-none"
                    style={{ border: CARD_BORDER, background: INPUT_BG, color: INK }}
                  />
                  <button
                    onClick={isCare ? handleSetCareCustomIcon : handleAddCustomIcon}
                    className="px-3 py-2 rounded-lg text-sm font-bold text-white flex-shrink-0"
                    style={{ background: MINT }}
                  >
                    {t.customIconAdd}
                  </button>
                </div>
              )}
              {customIconError && (
                <p className="text-xs font-medium mt-1" style={{ color: DANGER }}>{customIconError}</p>
              )}
            </div>
            <div key={isCare ? 'care-colors' : 'normal-colors'} className="flex gap-2 mb-2 flex-wrap picker-fade-swap">
              {(isCare ? CARE_COLOR_TAGS : COLOR_TAGS).map(c => (
                <button key={c.id} onClick={() => setColorId(c.id)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: c.hex }}>
                  {colorId === c.id && <Check size={14} color="#fff" />}
                </button>
              ))}
            </div>

            {/* 模式選擇：取代原本的「重複」區塊。五個選項互斥、一次只能選一個，預設「常規」。
                按鈕底色比照「地標詳情」卡片裡「原圖」按鈕的樣式：未選中時是一層半透明毛玻璃底色＋細邊框，
                選中時換成實色 ACCENT，質感跟卡片自訂背景那組按鈕統一。
                「生日」「關懷」沿用原本 toggleBirthday／toggleCare 的邏輯（見 selectMode）：
                選中「關懷」會自動把圖示與顏色換成素雅的紀念樣式，離開時還原成切換前的組合；
                選中「生日」則固定每年重複一次，不用另外設定重複週期。
                「陪伴」「紀念日」目前只記錄選中狀態，具體行為之後再依安排補上。 */}
            <div className="p-3 rounded-xl" style={{ border: CARD_BORDER, background: INPUT_BG }}>
              <div className="text-sm font-bold mb-2" style={{ color: INK }}>{t.modeSelectLabel}</div>
              {/* 切換動畫：滑動底色的 transform 改用略帶回彈的 cubic-bezier（先小幅過衝再回穩），
                  比原本純 ease-out 更有「跳」到定位的手感；文字標籤選中時加一個小幅 scale
                  pop，按下瞬間再用 .mode-select-btn:active 做輕微按壓回饋（inline style 沒辦法
                  寫 :active，所以額外開一個極小的 <style> 區塊）。下方提示文字改成隨 eventMode
                  換一次 key，靠 CSS keyframe 做淡入＋輕微上移的 crossfade，取代原本文字瞬間跳換。 */}
              <style>{`
                .mode-select-btn { transform: scale(1); transition: color 180ms ease, transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1); }
                .mode-select-btn:active { transform: scale(0.92); }
                .mode-select-btn.is-active { transform: scale(1.04); }
                @keyframes modeHintFadeIn {
                  from { opacity: 0; transform: translateY(-3px); }
                  to { opacity: 1; transform: translateY(0); }
                }
              `}</style>
              <div className="relative flex p-1 rounded-full" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute', top: 4, bottom: 4, left: 4,
                    width: 'calc((100% - 8px) / 5)', borderRadius: 999,
                    // 「關懷」被選中時，滑動底色改成素雅的灰（跟 CARE_MODE_VARS 裡的
                    // --accent 同一個顏色，跟關懷模式其他地方的視覺語言一致），其餘四個
                    // 模式維持原本的 ACCENT。背景色／陰影都加上 transition，切換到／離開
                    // 「關懷」時顏色會平滑地淡入淡出，而不是瞬間跳色。
                    // transform 改用帶一點回彈的 cubic-bezier，滑動到定位前會先小幅過衝再回穩，
                    // 手感比單純 ease-out 更自然、更有「跳」過去的流暢感。
                    background: eventMode === 'care' ? '#8B8B92' : ACCENT,
                    boxShadow: eventMode === 'care'
                      ? '0 2px 8px rgba(139,139,146,0.35)'
                      : '0 2px 8px rgba(108,123,224,0.35)',
                    transform: `translateX(${EVENT_MODES.findIndex(m => m.id === eventMode) * 100}%)`,
                    transition: 'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1), background 220ms ease, box-shadow 220ms ease',
                    willChange: 'transform',
                    pointerEvents: 'none',
                  }}
                />
                {EVENT_MODES.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => selectMode(m.id)}
                    className={'relative z-10 flex-1 min-w-0 rounded-full text-xs font-bold mode-select-btn' + (eventMode === m.id ? ' is-active' : '')}
                    style={{
                      padding: '7px 3px',
                      color: eventMode === m.id ? '#fff' : INK_SOFT,
                      background: 'transparent',
                    }}
                  >
                    {t[m.labelKey]}
                  </button>
                ))}
              </div>
              {(() => {
                const activeMode = EVENT_MODES.find(m => m.id === eventMode);
                return activeMode ? (
                  <p key={eventMode} className="text-xs mt-2" style={{ color: INK_SOFT, animation: 'modeHintFadeIn 220ms ease' }}>{t[activeMode.hintKey]}</p>
                ) : null;
              })()}
            </div>

            {/* 只有紀念日／常規模式提供可調整的循環設定。生日與關懷固定每年一次，陪伴不循環。
                改成跟「地標詳情」卡片「自訂」面板同一套做法：這個區塊永遠掛載著，只用
                maxHeight／opacity（固定、寬裕到蓋得住實際內容即可，不用精準量測）做純 CSS
                過渡；marginBottom 用來抵銷收合時外層 flex gap-3 仍會保留的那段間距，
                收合到底時才不會留下一小條看起來卡卡的空白。 */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                border: CARD_BORDER,
                background: INPUT_BG,
                boxShadow: '0 2px 10px rgba(35,39,51,0.04)',
                maxHeight: (eventMode === 'anniversary' || eventMode === 'regular') ? 260 : 0,
                opacity: (eventMode === 'anniversary' || eventMode === 'regular') ? 1 : 0,
                marginBottom: (eventMode === 'anniversary' || eventMode === 'regular') ? 0 : -12,
                transition: 'max-height 180ms cubic-bezier(0.22, 1, 0.36, 1), opacity 130ms ease, margin-bottom 180ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ minHeight: 52 }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="flex items-center justify-center rounded-lg flex-shrink-0"
                      style={{
                        width: 28,
                        height: 28,
                        background: repeat ? accentAlpha('16') : 'var(--card-border)',
                        color: repeat ? ACCENT : INK_SOFT,
                        transition: 'background 180ms ease, color 180ms ease',
                      }}
                    >
                      <Clock size={15} strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold leading-none" style={{ color: INK }}>{t.cycleLabel}</div>
                      <div className="text-[11px] mt-1" style={{ color: INK_SOFT }}>
                        {repeat
                          ? (repeatUnit === 'month' ? t.monthlyBadge(repeatInterval) : t.yearlyBadge(repeatInterval))
                          : '不循環'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={repeat}
                    aria-label={t.cycleLabel}
                    onClick={() => setRepeat(v => !v)}
                    className="relative flex-shrink-0 rounded-full"
                    style={{
                      width: 46,
                      height: 28,
                      padding: 3,
                      background: repeat ? ACCENT : 'rgba(120,125,135,0.22)',
                      border: repeat ? `1px solid ${ACCENT}` : '1px solid rgba(120,125,135,0.16)',
                      boxShadow: repeat ? `0 3px 10px ${accentAlpha('30')}` : 'inset 0 1px 2px rgba(0,0,0,0.06)',
                      transition: 'background 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
                    }}
                  >
                    <span
                      className="absolute rounded-full"
                      style={{
                        width: 20,
                        height: 20,
                        top: 3,
                        left: repeat ? 22 : 3,
                        background: '#fff',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                        transition: 'left 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                      }}
                    />
                  </button>
                </div>

                {/* 重複間隔子欄位：跟外層循環面板一樣，永遠掛載、只用固定的 maxHeight／opacity
                    做純 CSS 過渡；因為外層已經移除了 ResizeObserver 量測整份表單高度的機制，
                    這裡不會再有兩層動畫互相打架、回灌不同目標值的問題，單純一次到位。 */}
                <div
                  style={{
                    maxHeight: repeat ? 96 : 0,
                    opacity: repeat ? 1 : 0,
                    overflow: 'hidden',
                    transition: 'max-height 190ms cubic-bezier(0.22, 1, 0.36, 1), opacity 130ms ease',
                  }}
                >
                  <div className="px-4 pb-3">
                    <div
                      className="flex items-center gap-2 p-2 rounded-xl"
                      style={{
                        background: 'rgba(127,127,127,0.06)',
                        border: '1px solid rgba(127,127,127,0.08)',
                      }}
                    >
                      <span className="text-xs font-semibold flex-shrink-0" style={{ color: INK_SOFT }}>每</span>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={repeatInterval}
                        onChange={e => setRepeatInterval(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-14 h-9 px-1 rounded-lg text-sm text-center font-bold outline-none"
                        style={{
                          border: CARD_BORDER,
                          background: 'var(--card-bg)',
                          color: INK,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        }}
                      />
                      <select
                        value={calendar !== 'gregory' ? 'year' : repeatUnit}
                        onChange={e => setRepeatUnit(e.target.value)}
                        className="h-9 px-2 rounded-lg text-sm font-semibold outline-none flex-1 min-w-0"
                        style={{
                          border: CARD_BORDER,
                          background: 'var(--card-bg)',
                          color: INK,
                        }}
                        disabled={calendar !== 'gregory'}
                      >
                        <option value="year">{t.unitYear}</option>
                        <option value="month">{t.unitMonth}</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

            <button
              onClick={handleAdd}
              className="w-full py-2.5 rounded-full font-bold text-sm"
              style={{
                background: 'rgba(255,255,255,0.6)',
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                border: '1px solid rgba(60,64,67,0.25)',
                color: INK,
                boxShadow: '0 4px 16px rgba(31,38,135,0.12)',
              }}
            >
              {editingId ? t.saveChanges : t.addToTimeline}
            </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 「地標詳情」視窗：點一下時間軸卡片開啟，跟新增／編輯地標視窗一樣掛在 document.body 底下。
          不分手機或大屏，一律用同一種「置中彈窗＋點外部關閉」樣式，卡片大小本來就是用 max-w-sm／
          max-h-[85vh] 這種相對單位撐出來的，會自動適應螢幕大小，不需要為大屏另外做一份固定版面 */}
      {viewingEvent && createPortal(
        <LandmarkDetailModal
          ev={viewingEvent} lang={lang} t={t} isDark={isDark}
          onClose={() => setViewingId(null)}
          onSetBgImage={dataUrlOrNull => setEventBgImage(viewingEvent.id, dataUrlOrNull)}
          onSetBgOpacity={opacity => setEventBgOpacity(viewingEvent.id, opacity)}
          onSetNumberFont={fontId => setEventNumberFont(viewingEvent.id, fontId)}
        />,
        document.body
      )}

      {/* 刪除地標前的二次確認：跟帳號那邊「刪除帳號」用的是同一套風格
          （置中彈窗、AUTH_GLASS 毛玻璃卡片、標題用 DANGER 紅色），
          下面兩個按鈕並排：左邊「確認刪除」白底紅邊紅字、右邊「取消操作」紅底白字，
          不分手機或大屏都用同一種置中彈窗，不用像地標詳情那樣嵌進右側面板——這只是個短暫的二次確認，
          不需要那麼重的處理 */}
      {confirmDeleteEvent && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center px-6"
          style={{
            zIndex: 205,
            background: deleteModalPhase === 'shown' ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
            opacity: deleteModalPhase === 'hidden' ? 0 : 1,
            transition: `background ${DELETE_MODAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${DELETE_MODAL_DURATION}ms ease`,
          }}
          onClick={closeDeleteConfirm}
        >
          <div
            className={`w-full ${isLargeScreen ? 'max-w-sm' : 'max-w-xs'} p-6 rounded-2xl flex flex-col gap-3`}
            style={{
              ...AUTH_GLASS,
              opacity: deleteModalPhase === 'shown' ? 1 : 0,
              transform: deleteModalPhase === 'shown'
                ? 'translateY(0) scale(1)'
                : 'translateY(10px) scale(0.97)',
              transition: `opacity ${DELETE_MODAL_DURATION}ms ease, transform ${DELETE_MODAL_DURATION}ms cubic-bezier(0.34, 1.2, 0.64, 1)`,
              willChange: 'opacity, transform',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black" style={{ color: DANGER }}>{t.deleteLandmarkConfirmTitle}</h2>
              <button onClick={closeDeleteConfirm} aria-label={t.close} style={{ color: INK_SOFT }}><X size={18} /></button>
            </div>
            <p className="text-sm" style={{ color: INK }}>{t.deleteLandmarkConfirmDesc(confirmDeleteEvent.title)}</p>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => { deleteEvent(confirmDeleteEvent.id); closeDeleteConfirm(); }}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm"
                style={{ background: 'rgba(255,255,255,0.7)', border: `1px solid ${DANGER}`, color: DANGER }}
              >
                {t.confirmDeleteLandmark}
              </button>
              <button
                onClick={closeDeleteConfirm}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm"
                style={{ background: DANGER, color: '#fff' }}
              >
                {t.cancelDeleteLandmark}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
