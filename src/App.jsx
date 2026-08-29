import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  watchAuthState, completeEmailLinkSignInIfNeeded,
} from './lib/auth.js';
import { loadCloudData } from './lib/cloudSync.js';
import FeedbackModal from './components/FeedbackModal.jsx';
import { ALBUMS_KEY, ALBUM_PHOTOS_PREFIX, AlbumsFeature, collectAllAlbumPhotos, migrateInlineAlbumPhotos, photoSigFromAlbumPhotos, resolveAlbumsField } from './components/album/Album.jsx';
import { AnniversaryCalendar } from './components/calendar/Calendar.jsx';
import { SHOW_TEST_WATERMARK, TestVersionWatermark, Watermark } from './components/common/Loading.jsx';
import { BottomNavigation, SideNavigation } from './components/navigation/BottomNav.jsx';
import { AuthModal, INVITE_KEY, MergeDialog } from './components/settings/Account.jsx';
import { parseBackupPayload, saveCloudDataBestEffort, stableStringify } from './components/settings/Backup.jsx';
import { ProfilePage } from './components/settings/Settings.jsx';
import { TimelineSection } from './components/timeline/Timeline.jsx';
import { WorldClockSection } from './components/worldClock/WorldClock.jsx';
import { ACCENT, CARD_BG, DANGER, INK, INK_SOFT, MINT, glass } from './constants/colors.js';
import { SCHEDULE_VIEW_MODES } from './constants/eventModes.js';
import { LANGS, LOCALE_MAP } from './constants/languages.js';
import { NUMBER_FONTS, ensureGoogleFontLoaded } from './constants/numberFonts.js';
import { STRINGS } from './data/translations.js';
import { useIsLargeScreen } from './hooks/useOverlayTransition.js';
import { accentAlpha } from './utils/accentAlpha.js';
import { getEffectiveDate } from './utils/event.js';
import { getGreetingInfo } from './utils/timezone.js';

export const EVENTS_KEY = 'countdown-timeline-events';

export const CLOCKS_KEY = 'world-clock-list';

export const LANG_KEY = 'app-language';

export const DARK_KEY = 'app-dark-mode';

export const THEME_MODE_KEY = 'app-theme-mode';

export const CUSTOM_ICONS_KEY = 'custom-icon-emojis';

export const HOME_TZ_ID_KEY = 'world-clock-home-id'; // 世界時鐘「目前位置」設定的是哪一筆時鐘（存 id），修好重新整理後會回復原狀的問題

export const NOTIFY_ENABLED_KEY = 'event-notify-enabled';

export const NOTIFY_DAYS_BEFORE_KEY = 'event-notify-days-before';

export const NOTIFY_LOG_KEY = 'event-notify-log';

export default function App() {
  const [lang, setLang] = useState('zh-TW');
  const [clocks, setClocks] = useState([]);
  const [events, setEvents] = useState([]);
  const [isDark, setIsDark] = useState(false);
  // 「我的」→「日曆」裡勾選的曆法清單（西曆以外，可複選）：「日程」頁的日曆點選日期後，
  // 底部要一併顯示這些曆法對應的日期，兩邊共用同一份狀態。
  const [enabledAltCalendars, setEnabledAltCalendars] = useState([]);
  // 「外觀」設定的三段選項：'system'（跟隨系統）｜'light'｜'dark'。isDark 仍然是全 App 實際拿來
  // 判斷深色／淺色的唯一布林值，themeMode 只負責「決定 isDark 應該是什麼」，兩者用下面這個
  // effect 接起來——system 模式下跟著 prefers-color-scheme 走，並監聽系統切換即時更新；
  // 選定 light／dark 則直接固定，不受系統影響。
  const [themeMode, setThemeMode] = useState('system');
  useEffect(() => {
    if (themeMode === 'light') { setIsDark(false); return; }
    if (themeMode === 'dark') { setIsDark(true); return; }
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => setIsDark(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [themeMode]);
  const [loaded, setLoaded] = useState(false);
  // 版本更新提醒：只在 App(Capacitor 原生環境)裡，啟動時去問 GitHub 目前「已發布」的
  // 最新版本是多少（GitHub API 只回傳已發布的正式版，草稿不會出現，不用擔心把還在測試的
  // 草稿誤判成新版本），跟目前安裝的版本（來自 android/app/build.gradle 的 versionName，
  // 也就是 build workflow 裡那個 --version 輸入值）不一樣時，才顯示提醒。
  const [updateInfo, setUpdateInfo] = useState(null);
  // EVENTS_KEY（本機備份）最近一次寫入是否失敗——目前只有這個 key 有風險（事件量大＋標題很長時
  // 才可能頂到 window.storage 單一 key 的大小上限；相片已經另外拆到各自的 key，不會再拖累這裡)。
  // 供帳號按鈕顯示小紅點提示，避免存失敗卻完全沒人知道。
  const [localSaveError, setLocalSaveError] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [customIcons, setCustomIcons] = useState([]);
  const [homeTz, setHomeTz] = useState(null); // 世界時鐘中設定的「目前位置」時區，用來決定頂部問候語
  // 世界時鐘「目前位置」設定的是清單裡哪一筆（存 id）。原本這個狀態只存在 WorldClockSection
  // 元件自己的 local state 裡，元件一重新掛載（例如整頁重新整理）就會回到初始值 null，
  // 使用者原本設定好的「目前位置」就憑空消失。現在提升到 App 這一層，跟 events／clocks
  // 用同一套 window.storage 讀取／自動儲存機制，重新整理後才能維持原本設定。
  const [homeTzId, setHomeTzId] = useState(null);

  // App 一啟動就先載入「系統圓體」（Inter），因為它是全 App 數字的預設字體，
  // 不能等使用者打開某張卡片的自訂面板才動態載入，否則字體檔案還沒到位、
  // 瀏覽器會先 fallback 成系統字體，看起來像沒套用成功。
  useEffect(() => {
    const defaultFont = NUMBER_FONTS.find(f => f.id === 'inter');
    if (defaultFont) ensureGoogleFontLoaded(defaultFont.googleFont);
  }, []);

  // ---- 事件倒數日通知提醒 ----
  // notifyEnabled／notifyDaysBefore 是全域統一設定（所有事件共用同一個「提前幾天提醒」的天數）；
  // notifyLog 記錄每個事件「上一次已經通知過的是哪一次occurrence」（用目標日期字串當 key，
  // 不是存剩餘天數），這樣重複性事件（生日之類）明年再走到同一個天數時才不會被誤判成已經通知過。
  // notifyPermission 反映瀏覽器的 Notification 權限狀態；'unsupported' 表示這個瀏覽器根本沒有
  // Notification API（例如某些行動瀏覽器）。
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyDaysBefore, setNotifyDaysBefore] = useState(3);
  const [notifyLog, setNotifyLog] = useState({});
  const [notifyPermission, setNotifyPermission] = useState(
    typeof window !== 'undefined' && typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  // ---- 折叠屏展开／平板／桌面等大屏的分欄版面 ----
  // isLargeScreen 決定要不要切成「世界時鐘固定左側、時間軸在右側獨立捲動」的分欄版面。
  // 版面本身固定不變，不會因為開啟詳情視窗而重排——詳情視窗（時鐘／地標）一律用置中彈窗顯示，
  // 跟手機版共用同一套元件與樣式（見 WorldClockSection／TimelineSection 內部各自的 createPortal）。
  const isLargeScreen = useIsLargeScreen();
  const [viewingId, setViewingId] = useState(null);

  // ---- 相冊（獨立一級功能） ----
  // albums 是頂層清單（跟 events／clocks 同一層級），每筆相冊 {id, name, eventId, createdAt}——
  // eventId 可以是 null（不關聯任何事件），相片本體仍然各自存在 album-photos:{id} 這個 key。
  const [albums, setAlbums] = useState([]);
  // albumRoute 決定相冊功能目前顯示哪個畫面（home／create／detail），提升到這一層而不是放在
  // AlbumsFeature 元件自己的 state 裡，是因為切到「相冊」分頁時該元件才會掛載，如果狀態
  // 放在元件內部，每次切分頁都會被重置——而時間軸卡片上的「相冊」按鈕需要能直接指定「打開哪個
  // 相冊的詳細頁」或「進入建立流程並預先帶入這個事件」，這個狀態必須跨分頁切換也不遺失。
  const [albumRoute, setAlbumRoute] = useState({ screen: 'home', detailAlbumId: null, prefillEventId: null });

  // 時間軸卡片上「相冊」按鈕的共用邏輯：這個事件目前有沒有已經關聯的相冊——
  // 完全沒有就直接進入「建立相冊」流程並預先帶入這個事件（使用者不用再選一次事件）；
  // 已經有（可能不只一個）就直接跳進最近建立的那一個相冊詳細頁，不用先回相冊首頁再手動找。
  // 大螢幕原本另外有一套全螢幕覆蓋層可以不切分頁直接預覽，現在統一改成跟手機版一樣直接
  // 切到「相冊」分頁，兩種螢幕尺寸只有一套進入相冊的路徑。
  function openAlbumsForEvent(eventId) {
    const linked = albums.filter(a => a.eventId === eventId);
    if (linked.length) {
      const target = linked.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
      setAlbumRoute({ screen: 'detail', detailAlbumId: target.id, prefillEventId: null });
    } else {
      setAlbumRoute({ screen: 'create', detailAlbumId: null, prefillEventId: eventId });
    }
    navigateToTab('gallery');
  }

  // File Handling API：使用者在作業系統裡直接用「開啟檔案」／雙擊 .tzzwnb 備份檔、
  // 或對著已安裝的 App 圖示把 .tzzwnb 檔拖進去時，瀏覽器會啟動這個 PWA 並把檔案透過
  // window.launchQueue 傳進來（不會經過任何 <input type="file">）。這裡用一個小提示條
  // 顯示匯入結果，因為這種啟動方式當下不一定會打開帳號管理 Modal，使用者需要看得到回饋。
  const [fileHandlerMsg, setFileHandlerMsg] = useState(null); // { type: 'success' | 'error', text }
  const [nowTick, setNowTick] = useState(new Date());
  useEffect(() => { const iv = setInterval(() => setNowTick(new Date()), 30000); return () => clearInterval(iv); }, []);

  // ---- 「世界時鐘」次要時區清單（Part2）：改成「有高度上限、可自行捲動」的區塊 ----
  // 原本這裡的高度沒有上限（只有手動拖曳時間軸標題列才會收合），
  // 時區加太多就會把下面的時間軸整個推出畫面。現在固定給一個上限（依畫面高度換算），
  // 超過上限的時區改成在這個範圍內自行上下捲動查看，時間軸的位置不再受時區數量影響。
  //
  // 「目前位置」（Part 1）維持獨立於這個區塊之外、永遠置頂常駐顯示，不受下面任何捲動／收合影響。
  //
  // 收合／展開只能透過手動拖曳「時間軸」標題列觸發；原本「清單捲到底/頂會連動收合展開」的功能
  // 依需求已移除，避免使用者在清單裡正常上下捲動時不小心誤觸收合。
  const worldClockPart2Ref = useRef(null);
  const [worldClockPart2Height, setWorldClockPart2Height] = useState(null); // null = 自動（等於下面的 cap 上限）
  const [isDraggingWorldClock, setIsDraggingWorldClock] = useState(false);
  const worldClockDragRef = useRef(null); // { startY, startHeight }

  function getWorldClockPart2Cap() {
    if (typeof window === 'undefined') return 240;
    // 大約抓畫面高度的 3 成當作可視高度上限，太高（平板／桌機）或太矮（小手機）都夾在合理範圍內
    return Math.max(160, Math.min(320, Math.round(window.innerHeight * 0.3)));
  }
  const [worldClockPart2Cap, setWorldClockPart2Cap] = useState(getWorldClockPart2Cap);
  useEffect(() => {
    function onResize() { setWorldClockPart2Cap(getWorldClockPart2Cap()); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const worldClockPart2VisibleHeight = worldClockPart2Height != null ? worldClockPart2Height : worldClockPart2Cap;

  // 「時間軸」標題列拖曳收合世界時鐘 Part2：原本每個 pointermove 都直接 setState，
  // 而 Part2 的高度變化會牽動整棵世界時鐘元件樹（含裡面的時鐘卡片、國旗 portal 等）重新渲染，
  // 手指一移動就整棵重繪一次，在效能較弱的手機上會明顯卡頓、跟不上手指。
  // 改成拖曳過程中直接改 DOM 節點的 style.maxHeight（略過 React 的 render），
  // 並用 requestAnimationFrame 把同一輪裡多次的 pointermove 事件合併成一次，
  // 讓拖曳畫面能跟上螢幕更新率；真正的 React state 只在放開手指的那一刻提交一次即可。
  const worldClockDragFrameRef = useRef(null);
  function handleWorldClockDragStart(clientY) {
    worldClockDragRef.current = { startY: clientY, startHeight: worldClockPart2VisibleHeight, pendingHeight: worldClockPart2VisibleHeight };
    setIsDraggingWorldClock(true);
  }
  function handleWorldClockDragMove(clientY) {
    if (!worldClockDragRef.current) return;
    if (worldClockDragFrameRef.current) cancelAnimationFrame(worldClockDragFrameRef.current);
    worldClockDragFrameRef.current = requestAnimationFrame(() => {
      if (!worldClockDragRef.current) return;
      const { startY, startHeight } = worldClockDragRef.current;
      const next = Math.max(0, Math.min(startHeight + (clientY - startY), worldClockPart2Cap));
      worldClockDragRef.current.pendingHeight = next;
      const el = worldClockPart2Ref.current;
      if (el) el.style.maxHeight = `${next}px`;
    });
  }
  function handleWorldClockDragEnd() {
    if (worldClockDragFrameRef.current) { cancelAnimationFrame(worldClockDragFrameRef.current); worldClockDragFrameRef.current = null; }
    const finalHeight = worldClockDragRef.current ? worldClockDragRef.current.pendingHeight : worldClockPart2VisibleHeight;
    worldClockDragRef.current = null;
    setIsDraggingWorldClock(false);
    // 如果已經拉回接近上限，改回「自動」模式，之後畫面高度變化／清單內容改變才能自動跟著調整
    setWorldClockPart2Height(finalHeight >= worldClockPart2Cap - 1 ? null : finalHeight);
  }

  // ---- 帳號登入／雲端同步 ----
  const [fbUser, setFbUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  // 底部導覽列目前所在分頁，只在手機版（!isLargeScreen）有作用；大屏維持原本左右分欄，
  // 完全不看這個 state。放在 App 這一層而不是各分頁自己的 local state，是因為分頁互相
  // 切換時（例如切去「圖片庫」再切回「時光線」）不會重新掛載 WorldClockSection／
  // TimelineSection，兩者的內部狀態（捲動位置、展開的相冊、搜尋關鍵字等）才不會被重置。
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'home';

    const hash = window.location.hash.replace(/^#/, '');
    const validTabs = ['home', 'clock', 'schedule', 'gallery', 'profile'];

    return validTabs.includes(hash) ? hash : 'home';
  });

  function navigateToTab(tab) {
    const validTabs = ['home', 'clock', 'schedule', 'gallery', 'profile'];

    if (!validTabs.includes(tab)) return;

    setActiveTab(tab);

    if (typeof window !== 'undefined') {
      const currentHash = window.location.hash.replace(/^#/, '');

      if (currentHash !== tab) {
        window.location.hash = tab;
      }
    }
  }

  useEffect(() => {
    function handleHashChange() {
      const hash = window.location.hash.replace(/^#/, '');
      const validTabs = ['home', 'clock', 'schedule', 'gallery', 'profile'];

      setActiveTab(validTabs.includes(hash) ? hash : 'home');
    }

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);
  // 「日程」分頁（layout='cards'）專用的狀態，放在 App 這一層而不是 AnniversaryCalendar／
  // TimelineSection 自己的 local state，理由跟 activeTab 一樣：分頁切走切回時不希望被重置，
  // 而且日曆（AnniversaryCalendar）跟事件列表（TimelineSection）是兩個獨立元件，
  // 「目前時間範圍」「要不要看全部」這兩個狀態要同時餵給兩邊，本來就得放在共同的上層。
  // scheduleRange：日曆目前顯示的時間範圍，由 AnniversaryCalendar 的 onRangeChange 回報；
  // 初始值先假設是「本月」，等 AnniversaryCalendar 掛載後的第一個 effect 就會立刻覆寫成
  // 它自己算出的正確值（月檢視預設也是本月，兩者一致，不會有畫面閃一下又跳的情況）。
  const [scheduleRange, setScheduleRange] = useState(() => ({ mode: 'month', year: nowTick.getFullYear(), month: nowTick.getMonth() }));
  // 日曆目前的檢視模式（年／月／週），改由這一層控制、往下傳給 AnniversaryCalendar 當受控
  // 屬性，這樣頂部標題列和日曆之間新增的年／月／週滑塊（見下方 JSX）才能直接切換它，
  // 不用透過日曆元件內部才能改。
  const [scheduleViewMode, setScheduleViewMode] = useState('month');
  // 日曆左上角原本的「選擇年份／月份」按鈕已移除，改由頂部標題列（Header）的標題文字
  // 觸發同一個年份／月份選擇面板（見需求一）；面板本身的狀態仍留在 AnniversaryCalendar
  // 內部，這裡只需要一個 ref 就能呼叫它的 openPicker()，不用整個搬上來。
  const scheduleCalendarRef = useRef(null);
  // 「展示全部事件」開關，預設關閉——預設只看日曆目前選的月份（本月），跟日曆同步；
  // 開啟後改成不分月份、列出全部事件（見下方 TimelineSection 的 showAll 用法）。
  const [scheduleShowAll, setScheduleShowAll] = useState(false);
  // 「新增日程／搜尋」按鈕的實際掛載點：TimelineSection（cards 模式）用 createPortal 把
  // 按鈕渲染到這個節點，讓它們在畫面上出現在日曆上方，而不是 TimelineSection 元件本身
  // 所在的位置（日曆下方）。用 useState 而不是純 useRef，是因為 ref 在節點掛載瞬間拿到的
  // 值不會觸發重新渲染，createPortal 需要拿到真正的 DOM 節點才能運作，改用 setState 當
  // callback ref，節點一掛載就會重新渲染一次，讓 TimelineSection 那次渲染能拿到非 null 的值。
  const [scheduleControlsEl, setScheduleControlsEl] = useState(null);
  const [pendingMerge, setPendingMerge] = useState(null); // { local, cloud } 需要使用者選擇時才會有值
  const [syncStatus, setSyncStatus] = useState(null); // null | 'syncing' | 'synced'
  // 「我的」頁面「同步與資料」子頁面要顯示的「最後同步：X 前」——不新增一整套時間戳同步機制，
  // 單純在 syncStatus 變成 'synced' 的當下記一次本機時間即可，重新整理後歸零也沒關係
  // （沒有同步過就不顯示這行文字，不會顯示錯誤的時間）。
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  useEffect(() => { if (syncStatus === 'synced') setLastSyncedAt(Date.now()); }, [syncStatus]);
  const syncReadyRef = useRef(false); // 是否已經完成登入時的資料比對／合併，之後才開始自動推送變更
  const mergeCheckedUidRef = useRef(null); // 避免同一次登入重複檢查合併
  // 記錄「最近一次成功同步到雲端的相片內容長什麼樣子」（每個相冊底下有哪些相片 id、依序排列）。
  // 平常編輯事件標題、加時鐘、切換深色模式這些動作都會觸發自動推送，但這些改動根本沒動到相片，
  // 沒必要每次都把所有相片重新上傳一次（雖然 firebaseSync.js 那邊已經會跳過已經上傳過的相片，
  // 但仍然要重新整理索引、重新呼叫一次，量一多還是浪費）；靠這個簽章比對，只有相片真的變動過
  // （新增/刪除/搬移/排序/改相冊名不影響簽章，只有 id 的存在與順序才算）才會真的推送相片這部分。
  const lastSyncedPhotoSigRef = useRef('');

  // App 啟動時：先處理「Email 免密碼登入連結」回跳，再開始監聽登入狀態
  useEffect(() => {
    (async () => {
      try { await completeEmailLinkSignInIfNeeded(); } catch (err) {}
    })();
    const unsub = watchAuthState(u => {
      setFbUser(u);
      if (!u) { syncReadyRef.current = false; mergeCheckedUidRef.current = null; setSyncStatus(null); }
    });
    return () => unsub();
  }, []);

  // 登入後：比對本機資料與雲端資料，決定要合併、直接採用，還是跳出選項讓使用者決定
  useEffect(() => {
    if (!loaded || !fbUser) return;
    if (mergeCheckedUidRef.current === fbUser.uid) return;
    mergeCheckedUidRef.current = fbUser.uid;
    (async () => {
      // 相片是「盡力而為」附帶上去，不影響底下 sameData 的比對邏輯（見下方說明）
      const albumPhotos = await collectAllAlbumPhotos(albums);
      const localData = { clocks, events, lang, isDark, customIcons, albums, ...(Object.keys(albumPhotos).length ? { albumPhotos } : {}) };
      const hasLocalData = clocks.length > 0 || events.length > 0;
      let cloudData = null;
      try { cloudData = await loadCloudData(fbUser.uid); } catch (err) {}

      if (!cloudData) {
        const { ok, photosSynced } = await saveCloudDataBestEffort(fbUser.uid, localData);
        if (ok) {
          if (photosSynced) lastSyncedPhotoSigRef.current = photoSigFromAlbumPhotos(albumPhotos);
          syncReadyRef.current = true;
          setSyncStatus('synced');
        } else {
          // 這裡失敗代表使用者第一次登入、雲端還完全沒有備份，卻連骨架資料的首次上傳都失敗了。
          // 故意不把 syncReadyRef 設成 true——避免後續的自動推送 effect 誤以為「已經同步過」而
          // 放心地繼續疊加變動，讓下次登入的落差越滾越大；保留原樣，讓使用者看到錯誤提示後
          // 有機會先處理再重試。
          setSyncStatus('error');
        }
        return;
      }
      if (!hasLocalData) {
        applyCloudData(cloudData);
        syncReadyRef.current = true;
        setSyncStatus('synced');
        return;
      }
      // 是否跳出合併提示，只看事件／時鐘／相冊骨架是否一致——相片同不同步是「加分項」，
      // 不該讓使用者三不五時就被跳出來的合併視窗打斷。相冊用 resolveAlbumsField 統一解析，
      // 這樣不管雲端存的是新格式（頂層 albums）還是舊格式（事件內嵌 albums）都能正確比對。
      const sameData = stableStringify({ clocks: cloudData.clocks || [], events: cloudData.events || [], albums: resolveAlbumsField(cloudData) })
        === stableStringify({ clocks, events, albums });
      if (sameData) {
        syncReadyRef.current = true;
        setSyncStatus('synced');
        return;
      }
      setPendingMerge({ local: localData, cloud: cloudData });
    })();
  }, [fbUser, loaded]);

  function applyCloudData(data) {
    if (Array.isArray(data.clocks)) setClocks(data.clocks);
    if (Array.isArray(data.events)) setEvents(data.events);
    if (typeof data.lang === 'string' && LANGS.includes(data.lang)) setLang(data.lang);
    if (typeof data.isDark === 'boolean') { setIsDark(data.isDark); setThemeMode(data.isDark ? 'dark' : 'light'); }
    if (Array.isArray(data.customIcons)) setCustomIcons(data.customIcons);
    // 相冊：優先用資料裡明確帶的頂層 albums（新格式），並用 events 反推出的舊格式相冊補齊，
    // 確保不管這份資料是新版本存的還是舊版本存的，相冊都不會憑空消失。
    if (Array.isArray(data.events) || Array.isArray(data.albums)) setAlbums(resolveAlbumsField(data));
    // 相片同步是「盡力而為」：雲端資料如果帶著 albumPhotos，逐一寫回本機各自的
    // album-photos:{albumId} key；單一相冊寫入失敗就跳過那一個，不影響其他資料套用。
    if (data.albumPhotos && typeof data.albumPhotos === 'object') {
      Object.keys(data.albumPhotos).forEach(albumId => {
        const photos = data.albumPhotos[albumId];
        if (Array.isArray(photos)) {
          window.storage.set(ALBUM_PHOTOS_PREFIX + albumId, JSON.stringify(photos), false).catch(err => console.error(err));
        }
      });
    }
  }

  function resolveMerge(choice) {
    if (!pendingMerge || !fbUser) return;
    const { local, cloud } = pendingMerge;
    let final;
    if (choice === 'cloud') {
      final = cloud;
    } else if (choice === 'local') {
      // local.albumPhotos 只有「本機真的有相片」時才會被帶上（見合併檢查那邊的組裝邏輯）；
      // 這裡明確補上 {} 預設值，確保「以本機為主」在本機沒有任何相片時，也會把這個空狀態
      // 明確同步上去、蓋掉雲端原本可能有的相片索引，而不是因為欄位整個缺席，讓雲端那份
      // 索引原封不動留在那裡，跟「以本機為主」這個選擇的本意兜不起來。
      final = { ...local, albumPhotos: local.albumPhotos || {} };
    } else {
      // 「兩邊都要」：陣列型資料以 id 聯集，衝突時（同一個 id 兩邊都有）以本機版本為準——
      // 本機是使用者當下正在操作的裝置，這樣才不會讓還沒同步上雲端的最新變動被雲端舊資料蓋掉。
      // events 另外把 albums 欄位單獨聯集，確保任一邊新建的相冊都不會在合併時憑空消失。
      const mergeById = (localList, cloudList) => {
        const map = new Map();
        (cloudList || []).forEach(item => { if (item && item.id != null) map.set(item.id, item); });
        (localList || []).forEach(item => { if (item && item.id != null) map.set(item.id, item); });
        return Array.from(map.values());
      };
      const mergeEventsById = (localEvents, cloudEvents) => {
        const cloudMap = new Map();
        (cloudEvents || []).forEach(e => { if (e && e.id != null) cloudMap.set(e.id, e); });
        const seen = new Set();
        const result = (localEvents || []).filter(e => e && e.id != null).map(e => {
          seen.add(e.id);
          const cloudE = cloudMap.get(e.id);
          if (!cloudE) return e;
          const albumMap = new Map();
          (cloudE.albums || []).forEach(a => { if (a && a.id != null) albumMap.set(a.id, a); });
          (e.albums || []).forEach(a => { if (a && a.id != null) albumMap.set(a.id, a); });
          return { ...e, albums: Array.from(albumMap.values()) };
        });
        (cloudEvents || []).forEach(e => { if (e && e.id != null && !seen.has(e.id)) result.push(e); });
        return result;
      };
      // 相片同樣用 id 聯集（沿用 mergeById 的概念，這裡帶著相片陣列做兩層合併：先合出相冊 id
      // 的聯集，同一個相冊兩邊都有的話，裡面的相片再依 id 聯集一次），確保不管挑哪個相冊、
      // 不管是本機還是雲端先新增的相片，合併後都不會不見。
      const mergeAlbumPhotos = (localMap, cloudMap) => {
        const result = {};
        const ids = new Set([...Object.keys(localMap || {}), ...Object.keys(cloudMap || {})]);
        ids.forEach(id => {
          const photoMap = new Map();
          ((cloudMap && cloudMap[id]) || []).forEach(p => { if (p && p.id != null) photoMap.set(p.id, p); });
          ((localMap && localMap[id]) || []).forEach(p => { if (p && p.id != null) photoMap.set(p.id, p); });
          if (photoMap.size) result[id] = Array.from(photoMap.values());
        });
        return result;
      };
      final = {
        clocks: mergeById(local.clocks, cloud.clocks),
        events: mergeEventsById(local.events, cloud.events),
        lang: local.lang,
        isDark: local.isDark,
        customIcons: Array.from(new Set([...(local.customIcons || []), ...(cloud.customIcons || [])])),
        albums: mergeById(resolveAlbumsField(local), resolveAlbumsField(cloud)),
        albumPhotos: mergeAlbumPhotos(local.albumPhotos, cloud.albumPhotos),
      };
    }
    applyCloudData(final);
    saveCloudDataBestEffort(fbUser.uid, final)
      .then(({ ok, photosSynced }) => {
        if (photosSynced) lastSyncedPhotoSigRef.current = photoSigFromAlbumPhotos(final.albumPhotos);
        setSyncStatus(ok ? 'synced' : 'error');
      });
    setPendingMerge(null);
    syncReadyRef.current = true;
  }

  // 已登入且合併流程結束後，本機資料一有變動就（去抖動地）推送到雲端。
  // 相片實際內容存在 Firebase Storage（不再塞進 Firestore 文件），數量不太會受單一文件大小
  // 上限影響；但還是先比對簽章，只有相片真的變動過才把 albumPhotos 放進這次要送出的資料，
  // 避免像改個事件標題這種完全沒動到相片的小改動，也要重新整理一次相片索引、多跑一趟。
  // saveCloudDataBestEffort 仍然保留「整包試一次、失敗就退回只送骨架」這道保險：萬一相片上傳
  // 過程整個出錯，至少事件／時鐘等骨架資料不會被拖累卡住不同步。
  useEffect(() => {
    if (!loaded || !fbUser || !syncReadyRef.current) return;
    setSyncStatus('syncing');
    const timer = setTimeout(async () => {
      const albumPhotos = await collectAllAlbumPhotos(albums);
      const photoSig = photoSigFromAlbumPhotos(albumPhotos);
      const photosChanged = photoSig !== lastSyncedPhotoSigRef.current;
      const fullData = { clocks, events, lang, isDark, customIcons, albums, ...(photosChanged ? { albumPhotos } : {}) };
      const { ok, photosSynced } = await saveCloudDataBestEffort(fbUser.uid, fullData);
      if (photosSynced) lastSyncedPhotoSigRef.current = photoSig;
      setSyncStatus(ok ? 'synced' : 'error');
    }, 800);
    return () => clearTimeout(timer);
  }, [clocks, events, lang, isDark, customIcons, albums, fbUser, loaded]);


  useEffect(() => {
    (async () => {
      try { const g = await window.storage.get(INVITE_KEY, false); if (g && g.value === 'true') setUnlocked(true); } catch (err) {}
      let loadedEventsRaw = [];
      try { const e = await window.storage.get(EVENTS_KEY, false); if (e && e.value) { loadedEventsRaw = JSON.parse(e.value); setEvents(loadedEventsRaw); } } catch (err) {}
      try { const c = await window.storage.get(CLOCKS_KEY, false); if (c && c.value) setClocks(JSON.parse(c.value)); } catch (err) {}
      let loadedAlbumsRaw = [];
      try { const al = await window.storage.get(ALBUMS_KEY, false); if (al && al.value) loadedAlbumsRaw = JSON.parse(al.value); } catch (err) {}
      setAlbums(resolveAlbumsField({ events: loadedEventsRaw, albums: loadedAlbumsRaw }));
      try { const l = await window.storage.get(LANG_KEY, false); if (l && l.value && LANGS.includes(l.value)) setLang(l.value); } catch (err) {}
      // 外觀偏好：優先讀新的 THEME_MODE_KEY；舊版使用者只有 DARK_KEY（單純的淺色／深色布林值，
      // 沒有「跟隨系統」這個概念），第一次升級到新版時用它推回對應的 'light' / 'dark'，
      // 讓原本手動選好的主題不會因為升級就被重置成「跟隨系統」而突然變色。
      try {
        const tm = await window.storage.get(THEME_MODE_KEY, false);
        if (tm && tm.value && ['system', 'light', 'dark'].includes(tm.value)) {
          setThemeMode(tm.value);
        } else {
          const d = await window.storage.get(DARK_KEY, false);
          if (d && d.value) setThemeMode(d.value === 'true' ? 'dark' : 'light');
        }
      } catch (err) {}
      try { const ci = await window.storage.get(CUSTOM_ICONS_KEY, false); if (ci && ci.value) setCustomIcons(JSON.parse(ci.value)); } catch (err) {}
      try { const h = await window.storage.get(HOME_TZ_ID_KEY, false); if (h && h.value) setHomeTzId(h.value); } catch (err) {}
      try { const ne = await window.storage.get(NOTIFY_ENABLED_KEY, false); if (ne && ne.value) setNotifyEnabled(ne.value === 'true'); } catch (err) {}
      try { const nd = await window.storage.get(NOTIFY_DAYS_BEFORE_KEY, false); if (nd && nd.value) { const v = parseInt(nd.value, 10); if (Number.isFinite(v)) setNotifyDaysBefore(Math.max(0, Math.min(365, v))); } } catch (err) {}
      try { const nl = await window.storage.get(NOTIFY_LOG_KEY, false); if (nl && nl.value) setNotifyLog(JSON.parse(nl.value)); } catch (err) {}
      setAuthChecked(true);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => { if (loaded) window.storage.set(EVENTS_KEY, JSON.stringify(events), false).then(() => setLocalSaveError(false)).catch(err => { console.error(err); setLocalSaveError(true); }); }, [events, loaded]);
  useEffect(() => { if (loaded) window.storage.set(ALBUMS_KEY, JSON.stringify(albums), false).catch(err => console.error(err)); }, [albums, loaded]);
  useEffect(() => { if (loaded) window.storage.set(CLOCKS_KEY, JSON.stringify(clocks), false).catch(err => console.error(err)); }, [clocks, loaded]);
  useEffect(() => { if (loaded) window.storage.set(LANG_KEY, lang, false).catch(err => console.error(err)); }, [lang, loaded]);
  useEffect(() => { if (loaded) window.storage.set(DARK_KEY, String(isDark), false).catch(err => console.error(err)); }, [isDark, loaded]);
  useEffect(() => { if (loaded) window.storage.set(THEME_MODE_KEY, themeMode, false).catch(err => console.error(err)); }, [themeMode, loaded]);
  useEffect(() => { if (loaded) window.storage.set(CUSTOM_ICONS_KEY, JSON.stringify(customIcons), false).catch(err => console.error(err)); }, [customIcons, loaded]);
  useEffect(() => { if (loaded) window.storage.set(HOME_TZ_ID_KEY, homeTzId || '', false).catch(err => console.error(err)); }, [homeTzId, loaded]);
  useEffect(() => { if (loaded) window.storage.set(NOTIFY_ENABLED_KEY, String(notifyEnabled), false).catch(err => console.error(err)); }, [notifyEnabled, loaded]);
  useEffect(() => { if (loaded) window.storage.set(NOTIFY_DAYS_BEFORE_KEY, String(notifyDaysBefore), false).catch(err => console.error(err)); }, [notifyDaysBefore, loaded]);
  useEffect(() => { if (loaded) window.storage.set(NOTIFY_LOG_KEY, JSON.stringify(notifyLog), false).catch(err => console.error(err)); }, [notifyLog, loaded]);

  // 自我修復：不管 events 是從本機載入、雲端套用還是合併結果變來的，只要偵測到還是舊格式
  // （相片直接內嵌在 albums 裡），就自動搬去各自的 albumPhotos:{albumId} key，events 只留骨架。
  // 用 ref 擋掉搬遷過程中 setEvents 觸發的重複執行。
  const migratingAlbumsRef = useRef(false);
  useEffect(() => {
    if (!loaded || migratingAlbumsRef.current) return;
    const hasInline = events.some(e => Array.isArray(e.albums) && e.albums.some(a => Array.isArray(a.photos) && a.photos.length));
    if (!hasInline) return;
    migratingAlbumsRef.current = true;
    (async () => {
      const { events: migratedEvents } = await migrateInlineAlbumPhotos(events);
      setEvents(migratedEvents);
      migratingAlbumsRef.current = false;
    })();
  }, [events, loaded]);


  // ---- 事件倒數日通知提醒：權限請求 + 定時檢查 ----
  // 開啟通知的那一刻才跟瀏覽器要權限（不會一進 App 就跳權限視窗打擾使用者）；
  // 使用者若拒絕，開關會自動彈回關閉狀態，並顯示提示文字（見 NotifySettingsButton）。
  async function handleToggleNotify(next) {
    if (next) {
      if (typeof Notification === 'undefined') { setNotifyPermission('unsupported'); setNotifyEnabled(false); return; }
      let perm = Notification.permission;
      if (perm === 'default') {
        try { perm = await Notification.requestPermission(); } catch (err) { perm = 'denied'; }
        setNotifyPermission(perm);
      }
      if (perm !== 'granted') { setNotifyEnabled(false); return; }
    }
    setNotifyEnabled(next);
  }

  // 用 ref 保存「檢查函式要用到的最新值」，這樣下面 setInterval／visibilitychange 監聽器
  // 掛載時捕捉到的 closure 才不會用到過期的資料（例如使用者切換語言、改了提前天數之後，
  // 排程仍是一小時前掛上去的那個 interval，若沒用 ref 就會一直用到當時的舊值）
  const notifyEnabledRef = useRef(notifyEnabled);
  const notifyDaysBeforeRef = useRef(notifyDaysBefore);
  const notifyLogRef = useRef(notifyLog);
  const eventsRef = useRef(events);
  const langRef = useRef(lang);
  useEffect(() => { notifyEnabledRef.current = notifyEnabled; }, [notifyEnabled]);
  useEffect(() => { notifyDaysBeforeRef.current = notifyDaysBefore; }, [notifyDaysBefore]);
  useEffect(() => { notifyLogRef.current = notifyLog; }, [notifyLog]);
  useEffect(() => { eventsRef.current = events; }, [events]);
  useEffect(() => { langRef.current = lang; }, [lang]);

  // 檢查所有事件，剛好落在「提前 N 天」那一天就發系統通知。用 targetDate（實際發生日期）
  // 而不是 diffDays 數字當作「有沒有通知過」的 key，重複性事件（生日）明年走到同樣的天數
  // 才不會被誤判成已經通知過而漏發。
  function checkEventNotifications() {
    if (!notifyEnabledRef.current) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const today = new Date();
    const daysBefore = notifyDaysBeforeRef.current;
    const currentLog = notifyLogRef.current;
    const tt = STRINGS[langRef.current];
    let nextLog = null;
    eventsRef.current.forEach(ev => {
      const targetDate = getEffectiveDate(ev, today);
      const targetTime = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
      const todayTime = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      const diffDays = Math.ceil((targetTime - todayTime) / (1000 * 60 * 60 * 24));
      if (diffDays !== daysBefore) return;
      const occurrenceKey = `${targetDate.getFullYear()}-${targetDate.getMonth() + 1}-${targetDate.getDate()}`;
      if (currentLog[ev.id] === occurrenceKey) return; // 這次occurrence已經通知過了
      try {
        new Notification(tt.notifyTitle(ev.title), { body: tt.notifyBody(daysBefore), tag: `event-${ev.id}-${occurrenceKey}` });
      } catch (err) { /* 通知失敗（例如瀏覽器限制）就靜默跳過，不影響其他事件的檢查 */ }
      if (!nextLog) nextLog = { ...currentLog };
      nextLog[ev.id] = occurrenceKey;
    });
    if (nextLog) { notifyLogRef.current = nextLog; setNotifyLog(nextLog); }
  }

  // 開啟通知後：先立刻檢查一次，之後每小時檢查一次（涵蓋跨午夜、電腦睡眠喚醒等情況），
  // 分頁從背景切回前景時也順手檢查一次，這樣不用一直開著分頁狂刷也能及時收到提醒
  useEffect(() => {
    if (!loaded || !notifyEnabled) return;
    checkEventNotifications();
    const iv = setInterval(checkEventNotifications, 60 * 60 * 1000);
    function onVisible() { if (document.visibilityState === 'visible') checkEventNotifications(); }
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVisible); };
  }, [loaded, notifyEnabled]);

  // 新增／編輯事件、或調整了提前天數之後，也順手檢查一次——例如剛好新增一筆事件，
  // 目標日期正好落在提前天數上，不用等到下一次每小時排程才發現
  useEffect(() => {
    if (!loaded || !notifyEnabled) return;
    checkEventNotifications();
  }, [events, notifyDaysBefore]);

  // File Handling API consumer：對應 manifest.json 裡的 file_handlers。
  // 只有在已安裝的 PWA、且瀏覽器支援 window.launchQueue 時才會用得到（目前主要是桌面版 Chrome/Edge），
  // 不支援的瀏覽器（含大多數手機瀏覽器分頁模式）會直接跳過，完全不影響原本「匯入備份」按鈕那條路徑。
  // 要等資料先從 window.storage 載入完成（loaded）才處理，避免匯入的資料被隨後的初始載入覆蓋掉。
  useEffect(() => {
    if (!loaded) return;
    if (typeof window === 'undefined' || !('launchQueue' in window) || !window.launchQueue) return;
    window.launchQueue.setConsumer(async (launchParams) => {
      if (!launchParams || !launchParams.files || !launchParams.files.length) return;
      const msgs = STRINGS[lang];
      try {
        const file = await launchParams.files[0].getFile();
        const text = await file.text();
        const data = await parseBackupPayload(text);
        if (!data) {
          setFileHandlerMsg({ type: 'error', text: msgs.backupImportError });
          return;
        }
        applyCloudData(data);
        setFileHandlerMsg({ type: 'success', text: msgs.backupImportSuccess });
      } catch (err) {
        setFileHandlerMsg({ type: 'error', text: STRINGS[lang].backupImportError });
      }
    });
    // 沒有提供取消訂閱的方式，setConsumer 本身是冪等的（重複呼叫只是覆蓋掉上一個 consumer），
    // 所以這裡不需要、也不能回傳 cleanup function。
  }, [loaded, lang]);

  // 匯入提示條幾秒後自動消失，不需要使用者手動關閉
  useEffect(() => {
    if (!fileHandlerMsg) return;
    const timer = setTimeout(() => setFileHandlerMsg(null), 4000);
    return () => clearTimeout(timer);
  }, [fileHandlerMsg]);
  // 頁面底色改放到 <body> 上（而非包在最外層 div），這樣「置底」的測試版水印（負 z-index）
  // 才能疊在 body 底色之上、又被 App 內容蓋住其不透明的部分，達到「鋪在最底層」的效果。
  // transition 只設定一次(不放進 isDark 的 effect 裡,避免每次切換都重複指定同一個屬性),
  // 之後每次 isDark 改變、background 值變動時,瀏覽器就會自動用這個 transition 淡入淡出,
  // 取代原本瞬間切換的生硬感。只影響 body 底色本身,不會波及其他元件各自獨立的背景設定。
  useEffect(() => { document.body.style.transition = 'background 450ms ease'; }, []);
  useEffect(() => { document.body.style.background = isDark ? '#121419' : '#FFFFFF'; }, [isDark]);

  // App(Capacitor 原生環境)想要達到跟網頁版 PWA（viewport initial-scale=0.75）相同的密度感，
  // 但 Android WebView 對 initial-scale<1 支援不穩定（先前導致內容爆版），所以改用調整根字級
  // （rem 縮放）達成相同視覺效果。Tailwind 的 padding／gap／字級絕大多數都是 rem 為單位，
  // 改根字級會讓整體排版等比例縮小。上面時間軸圓點指示器原本用寫死的 px 值定位（left: -25），
  // 沒有跟著 rem 一起縮放才會跟軸線對不齊；已經把那處改成 rem，這裡才能放心重新套用縮放。
  // 同樣道理，header 的帳號／通知／深色模式切換按鈕、icon 選擇面板、匯出面板的切換按鈕，
  // 原本也是用寫死的 width/height px 值（34、36、30），縮放後跟旁邊已經一起縮小的文字、
  // 圖示比例對不上，看起來比其他內容都大一圈——已經一併改成 rem，全部統一跟著縮放。
  // 只在 App 環境套用；網頁版／PWA 完全不受影響，繼續用自己的 viewport 設定。
  useEffect(() => {
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      document.documentElement.style.fontSize = '68%';
    }
  }, []);

  // 修正 App 頂部跟手機狀態列（時間、電量那排）重疊的問題。Capacitor 預設在較新版本會讓
  // WebView 畫面延伸到狀態列底下（edge-to-edge），需要用 @capacitor/status-bar 外掛明確
  // 告訴系統「畫面內容不要疊在狀態列下面」，系統會自動把整個 WebView 往下推、空出狀態列
  // 的高度，不用自己算 safe-area 的 px 值去湊 padding，跨機型也比較不會有誤差。
  // 只在 App 環境套用；網頁版不受影響。
  useEffect(() => {
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      const StatusBar = window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar;
      if (StatusBar && StatusBar.setOverlaysWebView) {
        StatusBar.setOverlaysWebView({ overlay: false });
      }
    }
  }, []);

  // 「我的」頁面最下方顯示的實際版本號——只在原生 App 環境讀得到（App.getInfo().version，
  // 對應 android/app/build.gradle 的 versionName），刻意跟下面的 GitHub 版本更新檢查分開一個
  // effect：就算裝置離線／GitHub API 打不通，也不該連「目前版本號」都顯示不出來。
  // 網頁版（非原生殼）沒有這支 API，appVersion 會維持 null，「我的」頁面就不顯示版本這一行，
  // 不虛構一個版本號出來。
  const [appVersion, setAppVersion] = useState(null);
  useEffect(() => {
    if (!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) return;
    (async () => {
      try {
        const appInfo = await window.Capacitor.Plugins.App.getInfo();
        if (appInfo && appInfo.version) setAppVersion(appInfo.version);
      } catch (err) {
        // 讀不到就維持 null，「我的」頁面版本號那一行會直接不顯示
      }
    })();
  }, []);

  // 版本更新檢查：只在 App 環境跑，透過 @capacitor/app 外掛讀出目前安裝版本（App.getInfo().version，
  // 對應 android/app/build.gradle 的 versionName），跟 GitHub「最新已發布」release 的 tag 比對。
  // window.Capacitor.Plugins.App 是 Capacitor 核心橋接自動產生的代理，不需要在原始碼裡另外
  // import '@capacitor/app'，只要 workflow 有裝這個外掛、跑過 cap sync 讓它被原生端註冊即可。
  // 版本號用 x.y.z 逐段數字比較（而非字串比較），避免 "1.0.9" 被誤判比 "1.0.10" 新。
  useEffect(() => {
    if (!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) return;
    (async () => {
      try {
        const appInfo = await window.Capacitor.Plugins.App.getInfo();
        const currentVersion = appInfo.version;
        const res = await fetch('https://api.github.com/repos/zeewu92-lab/sgx.tzzwnb/releases/latest');
        if (!res.ok) return;
        const data = await res.json();
        const latestVersion = String(data.tag_name || '').replace(/^v/, '');
        if (!currentVersion || !latestVersion) return;
        const toParts = (v) => v.split('.').map(n => parseInt(n, 10) || 0);
        const [cMajor, cMinor, cPatch] = toParts(currentVersion);
        const [lMajor, lMinor, lPatch] = toParts(latestVersion);
        const isNewer = lMajor > cMajor
          || (lMajor === cMajor && lMinor > cMinor)
          || (lMajor === cMajor && lMinor === cMinor && lPatch > cPatch);
        if (isNewer) setUpdateInfo({ latestVersion });
      } catch (err) {
        // 檢查失敗（離線、API 限流等）就靜靜放過，不影響 App 正常使用
      }
    })();
  }, []);

  const t = STRINGS[lang];
  const now = nowTick;
  const todayStr = new Intl.DateTimeFormat(LOCALE_MAP[lang], { month: 'long', day: 'numeric', weekday: 'long' }).format(now);
  const greeting = getGreetingInfo(now, homeTz);

  const cssVars = isDark ? {
    '--ink': '#F2F3F6',
    '--ink-soft': 'rgba(242,243,246,0.55)',
    '--card-bg': '#1D2029',
    '--card-border': '#2B2F3A',
    '--input-bg': '#232733',
    '--page-bg': '#121419',
    '--header-bg': 'rgba(18,20,25,0.8)',
    '--accent': '#6C7BE0',
  } : {
    '--ink': '#232733',
    '--ink-soft': 'rgba(35,39,51,0.55)',
    '--card-bg': '#F7F8FA',
    '--card-border': '#ECEDF1',
    '--input-bg': '#FFFFFF',
    '--page-bg': '#FFFFFF',
    '--header-bg': 'rgba(255,255,255,0.8)',
    '--accent': '#6C7BE0',
  };

  if (!authChecked) return null;

  // 邀請碼機制暫時停用（如需重新啟用，把下面這個 if 區塊的註解拿掉即可）
  // if (!unlocked) {
  //   return (
  //     <div style={{ ...cssVars }}>
  //       <InviteGate lang={lang} t={t} onUnlocked={() => setUnlocked(true)} />
  //     </div>
  //   );
  // }

  return (
    <>
      {/* 全域「跟手」樣式：不是針對單一元件，而是整個 App 共用的一份基礎回饋規則。
          1. touch-action: manipulation — 部分行動瀏覽器即使關掉雙指縮放，仍可能對可點擊元素保留
             ~300ms 的「等等看是不是雙擊縮放」判斷延遲；明確宣告 manipulation 讓瀏覽器跳過這個判斷，
             點下去立刻觸發，不用等。
          2. -webkit-tap-highlight-color: transparent — 拿掉 iOS/Android 內建的點擊灰色／藍色
             閃爍疊層，那層預設高亮本身也有出現與淡出的動畫時間，會讓「點擊」跟「畫面反應」中間
             多一層視覺延遲感。
          3. button/[role="button"] 統一補上 active:scale(0.96) 的立即按壓回饋（96ms 線性、不用
             ease，是所有 transition 裡最快的一種），只要手指按下去的當下就有視覺變化，不必等
             onClick 真正處理完、狀態更新完、重新 render 完才看到反應——這是「感覺跟手」最關鍵的
             一步：按壓回饋要在事件處理完成之前、瀏覽器下一幀就先畫出來。
             選擇器刻意只用最單純的 button:active／[role="button"]:active（不加 .class 或
             :not()），specificity 壓到最低，這樣個別元件自己那套更具體的 active 動畫
             （例如上面的 .mode-select-btn:active、premium-range 滑塊的 :active）才會確實蓋掉
             這裡的預設值，不會被這條全域規則反過來蓋掉。disabled 的按鈕瀏覽器原生就不會觸發
             :active，所以不需要另外寫 :not(:disabled) 排除。 */}
      <style>{`
        button, [role="button"], a, input, select, textarea, summary {
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        button, [role="button"] {
          transition: transform 96ms linear;
        }
        button:active, [role="button"]:active {
          transform: scale(0.96);
        }
        /* 深色／淺色模式切換動畫：原本只有 body 背景色有淡入淡出，卡片、標題列等其他
           用 var(--card-bg)／var(--ink)／var(--card-border) 的地方是瞬間切換，
           兩者步調不一致看起來很怪。這裡把整個 App 範圍內的 background-color／color／
           border-color 都加上同樣時長的 transition，讓整個畫面的顏色一起變化。
           範圍限定在 #app-root 底下，不會影響到這個容器以外的東西（例如彈窗遮罩本身
           刻意用不同的 transition 時間，不受這裡影響）。 */
        #app-root, #app-root * {
          transition: background-color 450ms ease, border-color 450ms ease, color 450ms ease;
        }
      `}</style>
      <div id="app-root" className="flex flex-col overflow-hidden" style={{ ...cssVars, height: '100dvh', background: 'transparent', fontFamily: "'Inter', sans-serif" }}>
      {/* 縮放已經改由 index.html 的 viewport meta（initial-scale=0.75, user-scalable=no）
          統一在瀏覽器層級處理，這裡不再另外用 --ui-scale／transform 疊加一層。
          原本在這裡加的那層 JS 動態縮放，是靠 window.innerWidth 判斷裝置寬度決定要不要縮小；
          但 viewport meta 一旦設了 initial-scale，window.innerWidth 量到的就已經是「縮放過後」
          被放大的有效寬度（例如實際 360px 寬的手機，initial-scale=0.75 時量出來會是
          360/0.75=480），判斷門檻整個失真，而且等於在瀏覽器已經縮放過一次的畫面上，
          又疊加一次 CSS transform 縮放——這正是先前陸續出現「底部裁切」「整個置中留白」等
          問題的根本原因：兩層縮放互相打架。縮放只該有一層，交給 viewport meta 統一處理最乾淨、
          也最不會有計算誤差（字級、間距、留白全部由瀏覽器原生等比例一起處理）。 */}
        {/* 版本更新提醒彈窗：updateInfo 只有在偵測到 GitHub 已發布的最新版本比目前安裝版本
            新的時候才會有值（見上面的版本檢查 useEffect）。放在最外層容器最前面、蓋在所有
            內容之上，「稍後再說」單純關閉不留痕跡（下次重開 App 還是會再檢查一次），
            「立即更新」會導去 timezzw.top/download 下載頁，使用者在那頁
            點 apk 檔案連結下載安裝即可。 */}
        {updateInfo && (
          <div className="fixed inset-0 flex items-center justify-center px-6" style={{ zIndex: 500, background: 'rgba(0,0,0,0.5)' }}>
            <div className="w-full rounded-3xl p-6" style={{ maxWidth: 340, background: CARD_BG, boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
              <div className="text-lg font-bold mb-2" style={{ color: INK }}>發現新版本 v{updateInfo.latestVersion}</div>
              <div className="text-sm mb-5" style={{ color: INK_SOFT }}>建議更新以取得最新功能與修正。</div>
              <div className="flex gap-3">
                <button
                  onClick={() => setUpdateInfo(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: 'var(--card-border)', color: INK }}>
                  稍後再說
                </button>
                <button
                  onClick={() => { window.location.href = 'https://timezzw.top/download'; }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: ACCENT, color: '#fff' }}>
                  立即更新
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Header — 固定不動，不再需要 sticky（父層本身已不捲動）。
            這裡的 backdropFilter 會讓 header 自成一個新的堆疊環境（stacking context），
            裡面「切換語言」選單雖然設了 z-20，範圍也只在 header 自己這個環境內有效；
            header 跟下面的 <main> 是同一層的手足元素，沒有明確 z-index 時瀏覽器會照 DOM
            順序疊圖，導致排在後面的 <main>（例如世界時鐘的「添加時區」按鈕）蓋掉了 header
            展開的語言選單。加上 zIndex 讓 header 整層明確疊在 main 之上即可解決。 */}
        {/* paddingTop 用 env(safe-area-inset-top) 疊加一層保險：上面已經用 StatusBar 外掛
            告訴系統「畫面別疊到狀態列下面」，但不同機型／WebView 版本讓開的量可能還是有些
            微差異，這裡再用瀏覽器原生的安全區域變數多留一點空間。網頁版／沒有安全區域概念
            的環境下 env() 會是 0，不會多留任何空白，不影響 PWA 原本的間距。 */}
        <header className="px-6 py-6 flex items-center justify-between flex-shrink-0" style={{ background: 'var(--header-bg)', backdropFilter: 'blur(10px)', position: 'relative', zIndex: 30, paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
          <div>
            {/* 問候語只在「時光線」分頁顯示（桌面版沒有分頁切換的概念，永遠視同時光線）；
                其餘分頁改顯示對應的頁面標題，不再繼續顯示「下午好」這類首頁專屬文字。 */}
            {activeTab === 'home' ? (
              <>
                <h1 className="text-2xl font-black tracking-tight" style={{ color: INK }}>{t[greeting.key]} {greeting.emoji}</h1>
                <p className="text-xs font-medium mt-1" style={{ color: INK_SOFT }}>{t.todayIs(todayStr)}</p>
              </>
            ) : activeTab === 'schedule' ? (
              // 日程分頁的標題改顯示日曆目前檢視的年份／月份（或週範圍），不再固定顯示
              // 「日程」兩個字（見需求四）：mode 分別對應 AnniversaryCalendar 回報的
              // 'year' / 'month' / 'week'。原本日曆左上角那顆「選擇年份／月份」按鈕已經移除，
              // 改由這裡的標題文字直接觸發同一個選擇面板（見需求一），透過 scheduleCalendarRef
              // 呼叫 AnniversaryCalendar 用 useImperativeHandle 開放出來的 openPicker()。
              <button
                onClick={() => scheduleCalendarRef.current && scheduleCalendarRef.current.openPicker()}
                className="flex items-center gap-1.5"
                aria-label={t.calendarChooseDate}
              >
                <h1 className="text-2xl font-black tracking-tight" style={{ color: INK }}>
                  {(() => {
                    if (!scheduleRange) return t.navSchedule;
                    if (scheduleRange.mode === 'year') {
                      return new Intl.DateTimeFormat(LOCALE_MAP[lang], { year: 'numeric' }).format(new Date(scheduleRange.year, 0, 1));
                    }
                    if (scheduleRange.mode === 'week' && scheduleRange.weekStart && scheduleRange.weekEnd) {
                      const fmt = new Intl.DateTimeFormat(LOCALE_MAP[lang], { month: 'short', day: 'numeric' });
                      return `${fmt.format(scheduleRange.weekStart)} – ${fmt.format(scheduleRange.weekEnd)}`;
                    }
                    return new Intl.DateTimeFormat(LOCALE_MAP[lang], { year: 'numeric', month: 'long' }).format(new Date(scheduleRange.year, scheduleRange.month || 0, 1));
                  })()}
                </h1>
                <ChevronDown size={18} style={{ color: INK_SOFT }} />
              </button>
            ) : (
              <h1 className="text-2xl font-black tracking-tight" style={{ color: INK }}>
                {{ clock: t.worldClock, gallery: t.navGallery, profile: t.navProfile }[activeTab] || ''}
              </h1>
            )}
          </div>
          {/* 帳號／提醒／意見回饋／深色模式／語言這排圖示已經整組移除：大屏現在跟手機版一樣
              有「我的」分頁（見下面新增的 SideNavigation），這些功能全部在 ProfilePage 裡就找得到，
              不需要再重複放一份在 Header 上；相冊入口也一併移除，改由 SideNavigation 的
              「相冊」分頁直接進入，Header 精簡到只剩頁面標題。 */}
        </header>

        {/* Main Content：手機版跟大屏／桌面版現在共用同一套「五分頁」結構（見需求：大屏也要有
            跟手機版一樣的導覽列），差別只在：① 導覽列大屏放在右側直排（SideNavigation），
            手機版在底部橫排（BottomNavigation）；② 「時光線」（home）分頁裡，大屏維持原本
            左右分欄（世界時鐘固定左側、時間軸在右側獨立捲動），手機版維持原本上下堆疊＋
            可拖曳收合世界時鐘的手勢。其餘四個分頁（世界時鐘／日程／圖片庫／我的）內容完全
            共用同一份 JSX，不再各自维护一份。 */}
        {isLargeScreen ? (
          <div className="flex-1 min-h-0 flex flex-row">
            <main className="px-6 md:px-10 max-w-[1180px] mx-auto w-full flex-1 min-h-0 flex flex-col pb-4">
              <div style={{ display: activeTab === 'home' ? 'contents' : 'none' }}>
                {/* 折叠屏展開／平板／桌面等大屏：左右分欄——世界時鐘固定在左側、時間軸在右側獨立
                    捲動（類似郵件 App 左右分欄），版面本身固定不變。點卡片開啟「地標詳情」或
                    「目前位置時鐘詳情」時不再切換版面，改成跟手機版一樣的置中彈窗（見
                    WorldClockSection／TimelineSection 內部各自的 createPortal），彈窗大小用
                    max-w-sm／max-h-[85vh] 這種相對單位自動適應螢幕，點彈窗外部空白處即可關閉。 */}
                <div className="flex-1 min-h-0 flex flex-row gap-6">
                  <div id="world-clock-section-root" className="flex-shrink-0" style={{ width: 'clamp(300px, 34vw, 380px)' }}>
                    <WorldClockSection
                      clocks={clocks}
                      setClocks={setClocks}
                      lang={lang}
                      t={t}
                      onHomeTzChange={setHomeTz}
                      homeTzId={homeTzId}
                      setHomeTzId={setHomeTzId}
                      part2Ref={worldClockPart2Ref}
                      part2Height={worldClockPart2VisibleHeight}
                      isDraggingWorldClock={isDraggingWorldClock}
                      isLargeScreen
                      unlimitedHeight
                    />
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <TimelineSection
                      events={events}
                      setEvents={setEvents}
                      lang={lang}
                      t={t}
                      now={now}
                      isDark={isDark}
                      customIcons={customIcons}
                      setCustomIcons={setCustomIcons}
                      isLargeScreen
                      viewingId={viewingId}
                      setViewingId={setViewingId}
                      onOpenAlbumForEvent={openAlbumsForEvent}
                    />
                  </div>
                </div>
              </div>

              {activeTab === 'clock' && (
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <WorldClockSection
                    clocks={clocks}
                    setClocks={setClocks}
                    lang={lang}
                    t={t}
                    onHomeTzChange={setHomeTz}
                    homeTzId={homeTzId}
                    setHomeTzId={setHomeTzId}
                    unlimitedHeight
                  />
                </div>
              )}

              <div className="flex-1 min-h-0 flex flex-col gap-2" style={{ display: activeTab === 'schedule' ? 'flex' : 'none' }}>
                  <div ref={setScheduleControlsEl} className="flex-shrink-0 relative" style={{ zIndex: 31, marginTop: -34 }} />

                  <div className="relative flex p-1 rounded-full flex-shrink-0" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                    <div
                      aria-hidden="true"
                      style={{
                        position: 'absolute', top: 4, bottom: 4, left: 4,
                        width: 'calc((100% - 8px) / 3)', borderRadius: 999,
                        background: ACCENT,
                        boxShadow: '0 2px 8px rgba(108,123,224,0.35)',
                        transform: `translateX(${SCHEDULE_VIEW_MODES.findIndex(m => m.id === scheduleViewMode) * 100}%)`,
                        transition: 'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1), background 220ms ease, box-shadow 220ms ease',
                        willChange: 'transform',
                        pointerEvents: 'none',
                      }}
                    />
                    {SCHEDULE_VIEW_MODES.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setScheduleViewMode(m.id)}
                        className="relative z-10 flex-1 min-w-0 rounded-full text-xs font-bold"
                        style={{
                          padding: '7px 3px',
                          color: scheduleViewMode === m.id ? '#fff' : INK_SOFT,
                          background: 'transparent',
                          transition: 'color 180ms ease',
                        }}
                      >
                        {t[m.labelKey]}
                      </button>
                    ))}
                  </div>

                  <AnniversaryCalendar ref={scheduleCalendarRef} events={events} lang={lang} t={t} now={now} onRangeChange={setScheduleRange} viewMode={scheduleViewMode} setViewMode={setScheduleViewMode} enabledAltCalendars={enabledAltCalendars} />

                  <div className="flex items-center justify-between gap-2 flex-shrink-0 px-1">
                    <span className="text-xs" style={{ color: INK_SOFT }}>{t.futureOnlyLabel}</span>
                    <div className="rounded-2xl px-3 py-1.5 flex items-center gap-2 flex-shrink-0" style={glass()}>
                      <span className="text-xs" style={{ color: INK_SOFT }}>{t.scheduleShowAllLabel}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={scheduleShowAll}
                        aria-label={t.scheduleShowAllLabel}
                        onClick={() => setScheduleShowAll(v => !v)}
                        className="relative flex-shrink-0 rounded-full"
                        style={{
                          width: 38,
                          height: 22,
                          padding: 2,
                          background: scheduleShowAll ? ACCENT : 'rgba(120,125,135,0.22)',
                          border: scheduleShowAll ? `1px solid ${ACCENT}` : '1px solid rgba(120,125,135,0.16)',
                          boxShadow: scheduleShowAll ? `0 3px 10px ${accentAlpha('30')}` : 'inset 0 1px 2px rgba(0,0,0,0.06)',
                          transition: 'background 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
                        }}
                      >
                        <span
                          className="absolute rounded-full"
                          style={{
                            width: 16,
                            height: 16,
                            top: 2,
                            left: scheduleShowAll ? 18 : 2,
                            background: '#fff',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                            transition: 'left 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                          }}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <TimelineSection
                      events={events}
                      setEvents={setEvents}
                      lang={lang}
                      t={t}
                      now={now}
                      isDark={isDark}
                      customIcons={customIcons}
                      setCustomIcons={setCustomIcons}
                      viewingId={viewingId}
                      setViewingId={setViewingId}
                      onOpenAlbumForEvent={openAlbumsForEvent}
                      layout="cards"
                      controlsPortalEl={scheduleControlsEl}
                      rangeFilter={scheduleRange}
                      showAll={scheduleShowAll}
                    />
                  </div>
              </div>

              {activeTab === 'gallery' && (
                <AlbumsFeature
                  events={events}
                  setEvents={setEvents}
                  albums={albums}
                  setAlbums={setAlbums}
                  route={albumRoute}
                  setRoute={setAlbumRoute}
                  lang={lang}
                  t={t}
                  isLargeScreen={isLargeScreen}
                  onViewEvent={setViewingId}
                />
              )}

              {activeTab === 'profile' && (
                <ProfilePage
                  t={t}
                  fbUser={fbUser}
                  localSaveError={localSaveError}
                  syncStatus={syncStatus}
                  onOpenAuth={() => setShowAuthModal(true)}
                  notifyEnabled={notifyEnabled}
                  onToggleNotify={handleToggleNotify}
                  notifyDaysBefore={notifyDaysBefore}
                  setNotifyDaysBefore={setNotifyDaysBefore}
                  notifyPermission={notifyPermission}
                  onOpenFeedback={() => setShowFeedbackModal(true)}
                  isDark={isDark}
                  themeMode={themeMode}
                  setThemeMode={setThemeMode}
                  lang={lang}
                  setLang={setLang}
                  events={events}
                  albums={albums}
                  clocks={clocks}
                  customIcons={customIcons}
                  onImportBackup={applyCloudData}
                  lastSyncedAt={lastSyncedAt}
                  enabledAltCalendars={enabledAltCalendars}
                  setEnabledAltCalendars={setEnabledAltCalendars}
                  appVersion={appVersion}
                />
              )}
            </main>
            <SideNavigation activeTab={activeTab} setActiveTab={navigateToTab} t={t} />
          </div>
        ) : (
          /* 手機版：五個分頁的底部導覽列架構。
             「時光線」＝原本的複合式首頁（世界時鐘＋時間軸＋拖曳調整比例），完整保留、
             一個字都沒改，只是用 display:'contents' 切換可見度，不是條件渲染整個拔除——
             這樣切去其他分頁再切回來時，裡面的捲動位置、搜尋關鍵字、拖曳調整過的高度比例
             都還在，不會被重新掛載重置掉。其餘四個分頁（世界時鐘／紀念日／圖片庫／我的）
             各自是獨立、專注單一功能的頁面，離開再回來時內部小狀態（例如捲動位置）重置是
             正常、預期中的行為，跟大部分 App 的分頁一樣，不影響任何實際資料。 */
          <>
            <main className="px-6 max-w-md mx-auto w-full flex-1 min-h-0 flex flex-col">
              <div style={{ display: activeTab === 'home' ? 'contents' : 'none' }}>
                <div id="world-clock-section-root" className="flex-shrink-0">
                  <WorldClockSection
                    clocks={clocks}
                    setClocks={setClocks}
                    lang={lang}
                    t={t}
                    onHomeTzChange={setHomeTz}
                    homeTzId={homeTzId}
                    setHomeTzId={setHomeTzId}
                    part2Ref={worldClockPart2Ref}
                    part2Height={worldClockPart2VisibleHeight}
                    isDraggingWorldClock={isDraggingWorldClock}
                  />
                </div>
                <TimelineSection
                  events={events}
                  setEvents={setEvents}
                  lang={lang}
                  t={t}
                  now={now}
                  isDark={isDark}
                  customIcons={customIcons}
                  setCustomIcons={setCustomIcons}
                  onHeaderDragStart={handleWorldClockDragStart}
                  onHeaderDragMove={handleWorldClockDragMove}
                  onHeaderDragEnd={handleWorldClockDragEnd}
                  viewingId={viewingId}
                  setViewingId={setViewingId}
                  onOpenAlbumForEvent={openAlbumsForEvent}
                />
              </div>

              {/* 世界時鐘（獨立分頁）：不是把「時光線」首頁那個世界時鐘視窗原封不動搬過來——
                  這裡拿掉了首頁版本特有的高度上限與拖曳收合手勢（那是為了跟下面的時間軸
                  共用畫面高度才有的機制，這個獨立分頁沒有時間軸要爭空間），改用
                  unlimitedHeight 讓整頁世界時鐘用滿版面，更有獨立完整頁面的感覺；
                  城市／時區／時間顯示／城市管理／新增／刪除／排序等全部功能、資料邏輯都跟
                  「時光線」共用同一份 clocks／setClocks，一個字都沒少。 */}
              {activeTab === 'clock' && (
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <WorldClockSection
                    clocks={clocks}
                    setClocks={setClocks}
                    lang={lang}
                    t={t}
                    onHomeTzChange={setHomeTz}
                    homeTzId={homeTzId}
                    setHomeTzId={setHomeTzId}
                    unlimitedHeight
                  />
                </div>
              )}

              {/* 日程（獨立分頁）：頁面結構由上至下＝頁面標題（在最上面的 Header，這裡看不到）→
                  「新增日程／搜尋」操作 → 日曆 → 日程篩選設定（展示全部事件）→
                  對應的日程／事件列表。日曆（AnniversaryCalendar）跟事件列表（TimelineSection，
                  layout="cards"）資料共用同一份 events／處理邏輯，只是不再顯示時間軸的視覺結構，
                  改成單純的事件卡片，且列表內容跟著日曆目前選的月份／年份同步（見需求二、六）。
                  跟「時光線」（home）分頁一樣，這裡改成永遠掛載、用 display 控制顯示/隱藏，
                  不再用 activeTab === 'schedule' && (...) 這種條件渲染——後者每次切換分頁都會把
                  AnniversaryCalendar／TimelineSection 整個卸載再重新掛載，所有 useMemo 快取、
                  日曆目前選的月份、捲動位置全部歸零，這正是「從其他頁面切進日程頁很慢」的主因；
                  改成常駐掛載後，切分頁純粹是 CSS 顯示/隱藏，不會重新渲染整棵子樹。 */}
              <div className="flex-1 min-h-0 flex flex-col gap-2" style={{ display: activeTab === 'schedule' ? 'flex' : 'none' }}>
                  {/* 「新增日程／搜尋」按鈕的實際掛載點：內容由下面的 TimelineSection（cards 模式）
                      透過 createPortal 掛進來。改成用負的 marginTop 把這顆按鈕往上平移、蓋住
                      一半上面 Header 的標題列（見需求一），position:relative + zIndex 31（比
                      Header 的 zIndex:30 高）確定按鈕會疊在 Header 上面、不會被蓋住；因為這是
                      這個 flex 直排容器的第一個子元素，負的 marginTop 會把它、連同下面所有
                      內容（日曆、篩選列、事件列表）一起往上帶，等於「整體內容再向上移」
                      一次到位，不用另外再調一次外層容器的位置。 */}
                  <div ref={setScheduleControlsEl} className="flex-shrink-0 relative" style={{ zIndex: 31, marginTop: -34 }} />

                  {/* 年／月／週檢視滑塊：放在頂部標題列（Header）跟日曆之間，切換 scheduleViewMode，
                      直接控制下面 AnniversaryCalendar 的檢視模式（見需求四）。跟「新建地標」的
                      模式選擇同一種滑動選中膠囊樣式（見 SCHEDULE_VIEW_MODES）。 */}
                  <div className="relative flex p-1 rounded-full flex-shrink-0" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                    <div
                      aria-hidden="true"
                      style={{
                        position: 'absolute', top: 4, bottom: 4, left: 4,
                        width: 'calc((100% - 8px) / 3)', borderRadius: 999,
                        background: ACCENT,
                        boxShadow: '0 2px 8px rgba(108,123,224,0.35)',
                        transform: `translateX(${SCHEDULE_VIEW_MODES.findIndex(m => m.id === scheduleViewMode) * 100}%)`,
                        transition: 'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1), background 220ms ease, box-shadow 220ms ease',
                        willChange: 'transform',
                        pointerEvents: 'none',
                      }}
                    />
                    {SCHEDULE_VIEW_MODES.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setScheduleViewMode(m.id)}
                        className="relative z-10 flex-1 min-w-0 rounded-full text-xs font-bold"
                        style={{
                          padding: '7px 3px',
                          color: scheduleViewMode === m.id ? '#fff' : INK_SOFT,
                          background: 'transparent',
                          transition: 'color 180ms ease',
                        }}
                      >
                        {t[m.labelKey]}
                      </button>
                    ))}
                  </div>

                  <AnniversaryCalendar ref={scheduleCalendarRef} events={events} lang={lang} t={t} now={now} onRangeChange={setScheduleRange} viewMode={scheduleViewMode} setViewMode={setScheduleViewMode} enabledAltCalendars={enabledAltCalendars} />

                  {/* 這一整行本身不套毛玻璃背景，只有純文字提示＋真正的按鈕模組並排。
                      左邊「只展示未來待辦事件」是不可點擊的純文字說明，不需要背景卡片；
                      右邊「展示全部事件」文字＋開關才是真正的按鈕模組，毛玻璃背景縮小到只
                      包住這一小塊，不再整行都套上卡片背景。 */}
                  <div className="flex items-center justify-between gap-2 flex-shrink-0 px-1">
                    <span className="text-xs" style={{ color: INK_SOFT }}>{t.futureOnlyLabel}</span>
                    <div className="rounded-2xl px-3 py-1.5 flex items-center gap-2 flex-shrink-0" style={glass()}>
                      <span className="text-xs" style={{ color: INK_SOFT }}>{t.scheduleShowAllLabel}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={scheduleShowAll}
                        aria-label={t.scheduleShowAllLabel}
                        onClick={() => setScheduleShowAll(v => !v)}
                        className="relative flex-shrink-0 rounded-full"
                        style={{
                          width: 38,
                          height: 22,
                          padding: 2,
                          background: scheduleShowAll ? ACCENT : 'rgba(120,125,135,0.22)',
                          border: scheduleShowAll ? `1px solid ${ACCENT}` : '1px solid rgba(120,125,135,0.16)',
                          boxShadow: scheduleShowAll ? `0 3px 10px ${accentAlpha('30')}` : 'inset 0 1px 2px rgba(0,0,0,0.06)',
                          transition: 'background 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
                        }}
                      >
                        <span
                          className="absolute rounded-full"
                          style={{
                            width: 16,
                            height: 16,
                            top: 2,
                            left: scheduleShowAll ? 18 : 2,
                            background: '#fff',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                            transition: 'left 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                          }}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <TimelineSection
                      events={events}
                      setEvents={setEvents}
                      lang={lang}
                      t={t}
                      now={now}
                      isDark={isDark}
                      customIcons={customIcons}
                      setCustomIcons={setCustomIcons}
                      viewingId={viewingId}
                      setViewingId={setViewingId}
                      onOpenAlbumForEvent={openAlbumsForEvent}
                      layout="cards"
                      controlsPortalEl={scheduleControlsEl}
                      rangeFilter={scheduleRange}
                      showAll={scheduleShowAll}
                    />
                  </div>
              </div>

              {activeTab === 'gallery' && (
                <AlbumsFeature
                  events={events}
                  setEvents={setEvents}
                  albums={albums}
                  setAlbums={setAlbums}
                  route={albumRoute}
                  setRoute={setAlbumRoute}
                  lang={lang}
                  t={t}
                  isLargeScreen={isLargeScreen}
                  onViewEvent={setViewingId}
                />
              )}

              {activeTab === 'profile' && (
                <ProfilePage
                  t={t}
                  fbUser={fbUser}
                  localSaveError={localSaveError}
                  syncStatus={syncStatus}
                  onOpenAuth={() => setShowAuthModal(true)}
                  notifyEnabled={notifyEnabled}
                  onToggleNotify={handleToggleNotify}
                  notifyDaysBefore={notifyDaysBefore}
                  setNotifyDaysBefore={setNotifyDaysBefore}
                  notifyPermission={notifyPermission}
                  onOpenFeedback={() => setShowFeedbackModal(true)}
                  isDark={isDark}
                  themeMode={themeMode}
                  setThemeMode={setThemeMode}
                  lang={lang}
                  setLang={setLang}
                  events={events}
                  albums={albums}
                  clocks={clocks}
                  customIcons={customIcons}
                  onImportBackup={applyCloudData}
                  lastSyncedAt={lastSyncedAt}
                  enabledAltCalendars={enabledAltCalendars}
                  setEnabledAltCalendars={setEnabledAltCalendars}
                  appVersion={appVersion}
                />
              )}
            </main>
            <BottomNavigation activeTab={activeTab} setActiveTab={navigateToTab} t={t} />
          </>
        )}
      </div>
      {showAuthModal && (
        <AuthModal
          lang={lang} t={t} user={fbUser} onClose={() => setShowAuthModal(false)}
          backupData={{ clocks, events, lang, isDark, customIcons, albums }}
          onImportBackup={applyCloudData}
        />
      )}
      {showFeedbackModal && (
        <FeedbackModal onClose={() => setShowFeedbackModal(false)} />
      )}
      {pendingMerge && <MergeDialog t={t} onResolve={resolveMerge} />}
      {fileHandlerMsg && (
        <div
          className="fixed left-1/2 px-4 py-3 rounded-xl text-sm font-bold text-center shadow-lg"
          style={{
            // 手機版底下多了一條 Bottom Navigation，這個提示條原本貼著螢幕底部，
            // 現在要往上讓開導覽列的高度（含安全區），不然兩者會疊在一起。
            // 大屏沒有底部導覽列，維持原本的間距不變。
            bottom: isLargeScreen
              ? 'calc(24px + env(safe-area-inset-bottom, 0px))'
              : 'calc(80px + env(safe-area-inset-bottom, 0px))',
            transform: 'translateX(-50%)',
            zIndex: 100,
            maxWidth: '90vw',
            background: fileHandlerMsg.type === 'success' ? MINT : DANGER,
            color: '#fff',
          }}
        >
          {fileHandlerMsg.text}
        </div>
      )}
      <Watermark />
      {SHOW_TEST_WATERMARK && <TestVersionWatermark />}
    </>
  );
}
