import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, SlidersHorizontal, Share2, Settings } from 'lucide-react';
import { ACCENT, AUTH_GLASS, CARD_BG, CARD_BORDER, DANGER, INK, INK_SOFT, MINT, colorHex } from '../../constants/colors.js';
import { LOCALE_MAP } from '../../constants/languages.js';
import { NUMBER_FONTS, SIL_OFL_1_1_TEXT, ensureGoogleFontLoaded, getBigNumberFontSize, getNumberFontFamily, getNumberFontVariation } from '../../constants/numberFonts.js';
import { useModalBackClose } from '../../hooks/useModalBackClose.js';
import { useOverlayTransition } from '../../hooks/useOverlayTransition.js';
import { accentAlpha } from '../../utils/accentAlpha.js';
import { exportEventCardImage, shareOrDownloadImage } from '../../utils/export.js';
import { isImageDark, resizeImageFile } from '../../utils/image.js';
import { formatAltCalendar } from '../../utils/lunar.js';

export function LandmarkDetailModal({ ev, lang, t, isDark, onClose, onSetBgImage, onSetBgOpacity, onSetNumberFont, dock = false, closing = false }) {
  const [phase, setPhase] = useState('enter'); // 'enter' -> 'shown' -> 'closing'，動畫節奏同世界時鐘的視窗
  const CLOSE_DURATION = 60;
  useEffect(() => {
    const id = requestAnimationFrame(() => setPhase('shown'));
    return () => cancelAnimationFrame(id);
  }, []);
  // dock 模式下，App 那層换成別的卡片時會透過 closing 這個外部訊號要求播放關閉動畫，
  // 這裡只負責視覺效果，不會自己呼叫 onClose——卸載／換上新卡片的時機統一由 App 控制
  useEffect(() => {
    if (closing) setPhase('closing');
  }, [closing]);
  function handleClose() {
    setPhase('closing');
    setTimeout(onClose, CLOSE_DURATION);
  }
  useModalBackClose(true, handleClose);
  const shown = phase === 'shown';

  // 視窗開著時鎖住背後頁面的捲動：非 dock（手機置中彈窗）模式下，視窗本身雖然是 fixed 定位，
  // 但如果背後的頁面還能被手指滑動，視覺上會讓人覺得「整張卡片被拖走」了（如截圖所示，
  // 卡片跟著背後時間軸一起位移）。這裡在視窗掛載期間把 body 捲動鎖住，卸載時還原，
  // dock（分欄嵌入右側面板）模式不受影響，因為它本來就不是蓋在整頁上面的彈窗。
  useEffect(() => {
    if (dock) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [dock]);

  // 自動判斷背景圖是偏亮還是偏暗，跟匯出圖片共用同一套判斷邏輯（見 isImageDark）。
  const [bgIsDark, setBgIsDark] = useState(false);
  useEffect(() => {
    if (!ev.bgImage) { setBgIsDark(false); return; }
    let cancelled = false;
    const img = new Image();
    img.onload = () => { if (!cancelled) setBgIsDark(isImageDark(img)); };
    img.onerror = () => setBgIsDark(false);
    img.src = ev.bgImage;
    return () => { cancelled = true; };
  }, [ev.bgImage]);

  // 「調節遮罩透明度」面板要用到的幾個數值，搬到 cardInk 判斷之前，因為下面的黑／白字邏輯
  // 現在也需要用到 overlaySliderValue（遮罩透明度滑桿數值，0～100）。
  // bgOverlayOpacity 0～1 代表遮罩本身的不透明度；-1 是一個保留值，代表「清除玻璃效果（原圖模式）」。
  // 這樣可以在不新增資料欄位的前提下保存「原圖模式」，也能兼容既有事件資料。
  // 預設（使用者從未調整過）的遮罩不透明度是 0.75，對應滑桿數值 25（=「25% 透明」）。
  const glassCleared = ev.bgOverlayOpacity === -1;
  // 遮罩預設值：使用者剛上傳圖片、還沒自己調整過時，滑桿數值預設是 100（遮罩幾乎完全透明，直接看到照片）。
  const DEFAULT_BG_OPACITY = 0;
  // 卡片沒有自訂背景圖片時，卡片本身的毛玻璃底色透明度固定是 25（即 75% 不透明）。
  const NO_IMAGE_CARD_OPACITY = 0.75;
  const bgOpacity = glassCleared ? 0 : Math.max(0, Math.min(1, ev.bgOverlayOpacity != null ? ev.bgOverlayOpacity : DEFAULT_BG_OPACITY));
  const SLIDER_MAX = 100;
  // 滑桿數值＝「透明度」，0～100：0 是遮罩完全不透明，100 是遮罩完全消失（等同看到原圖）。
  const overlaySliderValue = Math.round((1 - bgOpacity) * SLIDER_MAX);

  // 只有「直接蓋在背景圖片上、自己沒有另外一層實色底色」的文字／圖示，才需要在背景偏暗時
  // 換成白色，否則像素卡片背景、標籤徽章這些本來就有自己實色底色的元素，字色反而不該跟著換
  // （不然背景偏亮時的白底配白字、或背景偏暗時深色底配深色字，都會變得完全看不見）。
  // 但遮罩透明度（overlaySliderValue）小於等於 35 時，遮罩本身已經蓋得相當不透明，畫面幾乎
  // 被遮罩蓋掉、看不太出原始照片深淺，這時候還照原始照片亮度翻轉，反而常常看不清楚。
  // 這種情況直接取消翻轉，改用固定顏色——但遮罩顏色現在跟著 App 深色／淺色模式走（見下面
  // 遮罩那層 div：淺色模式白色、深色模式改用跟匯出圖片一致的深色 rgba(20,22,28,...)），
  // 所以固定顏色也要跟著遮罩本身的顏色走：遮罩是白色（淺色模式）時固定用黑色，遮罩是深色
  // （深色模式）時固定用白色，才不會變成「黑字疊在幾乎全暗的遮罩上」完全看不見。
  const overlayNearOpaque = ev.bgImage && !glassCleared && overlaySliderValue <= 35;
  const cardInk = overlayNearOpaque ? (isDark ? '#fff' : '#000') : (ev.bgImage && bgIsDark ? '#fff' : INK);
  const cardInkSoft = overlayNearOpaque ? (isDark ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.78)') : (ev.bgImage && bgIsDark ? 'rgba(255,255,255,0.78)' : INK_SOFT);

  const [uploading, setUploading] = useState(false);
  const [bgError, setBgError] = useState('');
  const fileInputRef = useRef(null);
  // 「調節遮罩透明度」面板的展開狀態：只有設定過自訂背景圖片時才有意義。
  // bgOverlayOpacity 始終代表「遮罩本身」的不透明度；毛玻璃 blur 效果固定，不由此滑桿控制。
  const [showOpacityAdjust, setShowOpacityAdjust] = useState(false);
  const originalImageLabel = lang === 'zh-TW' ? '原圖' : lang === 'ja' ? '原画像' : lang === 'ko' ? '원본' : 'Original';
  // 「原圖」改成滑桿右側一顆獨立的長條按鈕：記住切換到原圖模式之前的透明度，
  // 這樣再次點擊取消原圖模式時，可以還原回使用者原本調整的數值，而不是每次都跳回預設值。
  const lastOpacityRef = useRef(bgOpacity);
  useEffect(() => {
    if (!glassCleared) lastOpacityRef.current = bgOpacity;
  }, [bgOpacity, glassCleared]);
  function toggleOriginalImage() {
    if (glassCleared) {
      onSetBgOpacity(lastOpacityRef.current != null ? lastOpacityRef.current : DEFAULT_BG_OPACITY);
    } else {
      onSetBgOpacity(-1);
    }
  }
  // 拖動滑桿時即時顯示目前的透明度數值：mousedown/touchstart 開始顯示，
  // 放開（可能是放在滑桿以外的地方）時透過 window 上的事件監聽收起，避免手指滑出滑桿範圍後數值提示卡住不消失。
  const [sliderDragging, setSliderDragging] = useState(false);
  useEffect(() => {
    if (!sliderDragging) return;
    const stop = () => setSliderDragging(false);
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchend', stop);
    window.addEventListener('touchcancel', stop);
    return () => {
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('touchend', stop);
      window.removeEventListener('touchcancel', stop);
    };
  }, [sliderDragging]);
  // 滑塊本身顯示的數值：平常跟著 overlaySliderValue（來自已提交的 bgOpacity）走，
  // 但拖動當下改成完全由本地 state 即時驅動，不等父層那份被節流過的 state，
  // 這樣滑塊視覺位置永遠跟手指同步，一放開才把「當下本地值」跟外部已提交值重新對齊。
  const [localSliderValue, setLocalSliderValue] = useState(overlaySliderValue);
  useEffect(() => {
    if (!sliderDragging) setLocalSliderValue(overlaySliderValue);
  }, [overlaySliderValue, sliderDragging]);
  // 白色遮罩實際顯示用的不透明度：拖動當下直接由 localSliderValue（零延遲的本地 state）換算，
  // 不要再等 bgOpacity——bgOpacity 來自父層的 ev.bgOverlayOpacity，是透過 onSetBgOpacity 用
  // requestAnimationFrame 節流、且會觸發整個視窗（甚至更外層）重新渲染的「已提交」值，實際更新
  // 速度天生就會落後於滑塊本身的移動，造成「滑桿滑得很順、但遮罩變化明顯慢半拍」的落差感。
  // 拖動結束後 sliderDragging 變 false，就自動切回吃已提交的 bgOpacity，行為完全不變。
  const displayBgOpacity = sliderDragging ? Math.max(0, Math.min(1, 1 - localSliderValue / SLIDER_MAX)) : bgOpacity;
  // 拖動滑桿時，用 requestAnimationFrame 把「實際送去改變 bgOpacity（觸發整個視窗重新渲染）」
  // 的次數節流到最多每畫格一次；但滑塊本身要跟手指完全零延遲，所以另外用一份本地 state
  // 直接綁在 input 的 value 上，每個原生事件都立即更新，不受節流影響——節流只延遲「連動效果」
  // （白色遮罩、拖動數值氣泡背後真正送出的資料），不會延遲「手指拖著滑塊移動」這個動作本身。
  const sliderRafRef = useRef(null);
  useEffect(() => () => { if (sliderRafRef.current) cancelAnimationFrame(sliderRafRef.current); }, []);
  // 「自訂」二級面板：把卡片背景／數字字體這些比較次要的設定收在齒輪按鈕後面，
  // 預設收合，點擊後視窗才會縱向加長展開，避免一打開詳情視窗就塞滿一堆按鈕
  const [showCustomizePanel, setShowCustomizePanel] = useState(false);
  // 「數字字體」標題旁的 ⓘ：預設收合，點一下才展開字體相關的補充說明。
  // 這顆按鈕刻意放在字體橫向捲動清單「外面」（同一列但不在 overflow-x-auto 容器內），
  // 所以捲動字體清單時 ⓘ 固定在標題右側不會跟著跑，比原本可能被捲動帶走的做法穩定。
  const [showFontInfo, setShowFontInfo] = useState(false);
  // 「查看授權資訊」再往下一層的完整條款彈窗：預設收合，避免一長串 OFL 全文一開卡片就佔滿畫面
  const [showFontLicenseModal, setShowFontLicenseModal] = useState(false);
  // 這兩層都掛進同一套「Esc／手機返回」堆疊：兩層目前設計上互斥（開條款彈窗時會同時關掉浮層），
  // 但仍各自掛勾是為了在堆疊裡佔到正確的「上層」位置——按一次 Esc 只關最上面那層，不會兩層一起關掉。
  useModalBackClose(showFontInfo, () => setShowFontInfo(false));
  useModalBackClose(showFontLicenseModal, () => setShowFontLicenseModal(false));
  // 掛載＋淡入淡出動畫狀態，見 useOverlayTransition 定義處的說明
  const [fontInfoMounted, fontInfoShown] = useOverlayTransition(showFontInfo, 120);
  const [fontLicenseMounted, fontLicenseShown] = useOverlayTransition(showFontLicenseModal, 130);
  const numberFontId = ev.numberFont || 'inter';
  const numberFontFamily = getNumberFontFamily(numberFontId);
  const numberFontVariation = getNumberFontVariation(numberFontId);
  // 中央大數字實際顯示的內容與位數：當天（diffDays === 0）改顯示文字訊息——生日模式顯示「生日快樂！」，
  // 其餘模式（關懷／紀念日／常規）顯示「一切順利！」，不走位數對照表（見下方 isTodayTextMessage 分支）；
  // 其餘情況一律取絕對值（不顯示正負號），位數依字串長度動態決定字級，見 getBigNumberFontSize。
  const isCompanionMode = ev.mode === 'companion';
  const isTodayTextMessage = !isCompanionMode && ev.diffDays === 0;
  const isZh = lang === 'zh-TW';
  const bigNumberDisplay = isCompanionMode
    ? String(Math.max(0, ev.elapsedDays ?? 0))
    : ev.diffDays === 0 ? (ev.isBirthday ? t.birthdayCelebrationText : t.allGoodText) : String(Math.abs(ev.diffDays));
  // 「生日快樂！」／「一切順利！」是一整句文字，不是數字位數，用固定字級（比照 4～5 位數的縮小級距）避免撐爆卡片寬度。
  // 中文版卡片內字級比其他語言再放大一些；其他語言字級維持原本大小
  // （英文只在下面 canvas 匯出時放大，詳情卡片本身不放大）。
  const bigNumberFontSize = isTodayTextMessage
    ? (isZh ? 70 : 52)
    : getBigNumberFontSize(bigNumberDisplay.length);
  const todayTextFontFamily = numberFontFamily;
  // 卡片一渲染就先載入「目前選中的」這款字體（若不是預設的系統圓體，例如使用者曾選過其他字體），
  // 不等使用者打開自訂面板才載入，否則字體檔案還沒到位、瀏覽器會先 fallback 成系統字體。
  // 系統圓體本身已經在 App 啟動時全域載入過了，這裡主要是補載「非預設」的字體。
  useEffect(() => {
    const current = NUMBER_FONTS.find(f => f.id === numberFontId);
    if (current) ensureGoogleFontLoaded(current.googleFont);
  }, [numberFontId]);
  // 面板打開後再把「其餘」字體也載入，方便使用者切換時預覽（系統圓體／Quicksand 不需要，其餘幾款才需要）
  useEffect(() => {
    if (!showCustomizePanel) return;
    NUMBER_FONTS.forEach(f => ensureGoogleFontLoaded(f.googleFont));
  }, [showCustomizePanel]);

  async function handleFileChange(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // 清空，允許之後重新選同一個檔案也能觸發 onChange
    if (!file) return;
    setUploading(true);
    setBgError('');
    try {
      const dataUrl = await resizeImageFile(file);
      onSetBgImage(dataUrl);
    } catch (err) {
      setBgError(t.customBgError);
    } finally {
      setUploading(false);
    }
  }

  const dateStr = ev.targetDate.toLocaleDateString(LOCALE_MAP[lang], { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const origDateStr = ev.date ? new Date(`${ev.date}T00:00:00`).toLocaleDateString(LOCALE_MAP[lang]) : '';
  const showOrigDate = !!ev.repeat && origDateStr && origDateStr !== dateStr;
  const altCalendarStr = ev.calendar && ev.calendar !== 'gregory' ? formatAltCalendar(ev.targetDate, ev.calendar, lang, t) : '';

  // 匯出成圖片：使用者先選格式（卡片 / 限動），再實際產生 PNG 並分享或下載
  const [exportFormat, setExportFormat] = useState('card'); // 'card' | 'story'
  const [showExportPanel, setShowExportPanel] = useState(false); // 「匯出成圖片」收合面板，跟「更換圖片」同一排的 icon 按鈕觸發
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  async function handleExport() {
    setExporting(true);
    setExportError('');
    try {
      const exportEv = { ...ev, dateStr, origDateStr, showOrigDate, altCalendarStr, numberFontFamily, numberFontVariation };
      const { blob, filename } = await exportEventCardImage(exportEv, lang, t, isDark, exportFormat);
      await shareOrDownloadImage(blob, filename, t);
    } catch (err) {
      setExportError(t.exportError);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
    <div
      className={dock ? 'relative h-full w-full' : 'fixed inset-0 flex items-center justify-center px-6'}
      style={dock ? undefined : { zIndex: 200, background: shown ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)', transition: `background ${CLOSE_DURATION}ms ease`, touchAction: 'none' }}
      onClick={dock ? undefined : handleClose}
      onTouchMove={dock ? undefined : (e => { if (e.target === e.currentTarget) e.preventDefault(); })}
    >
      {/* 極簡透明度滑桿：細軌道＋小圓形滑塊，與卡片 UI 保持一致。
          滑桿只代表「遮罩顯隱程度」，不會改變 backdrop-filter 的模糊強度。 */}
      <style>{`
        .premium-range {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 24px;
          margin: 0;
          padding: 0;
          border-radius: 999px;
          outline: none;
          cursor: pointer;
          background: transparent;
        }
        .premium-range::-webkit-slider-runnable-track {
          height: 3px;
          border-radius: 999px;
          background: transparent;
        }
        .premium-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          margin-top: -9.5px;
          border: 1px solid rgba(255,255,255,0.88);
          border-radius: 50%;
          background: rgba(255,255,255,0.96);
          box-shadow: 0 1px 5px rgba(0,0,0,0.2);
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }
        .premium-range::-webkit-slider-thumb:active {
          transform: scale(1.08);
          box-shadow: 0 1px 6px rgba(0,0,0,0.24), 0 0 0 5px rgba(108,123,224,0.14);
        }
        .premium-range::-moz-range-track {
          height: 3px;
          border-radius: 999px;
          background: transparent;
        }
        .premium-range::-moz-range-progress {
          height: 3px;
          border-radius: 999px;
          background: ${colorHex(ev.colorId)};
        }
        .premium-range::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border: 1px solid rgba(255,255,255,0.88);
          border-radius: 50%;
          background: rgba(255,255,255,0.96);
          box-shadow: 0 1px 5px rgba(0,0,0,0.2);
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }
        .premium-range::-moz-range-thumb:active {
          transform: scale(1.08);
        }
        .premium-range:focus-visible {
          outline: 2px solid ${accentAlpha('55')};
          outline-offset: 3px;
        }
        /* 匯出格式滑塊開關：卡片／限動(9:16) 兩個選項用會滑動的膠囊背景表示目前選中哪一個 */
        .export-format-toggle {
          position: relative;
          display: flex;
          padding: 3px;
          border-radius: 999px;
          background: var(--card-border);
        }
        .export-format-toggle .toggle-thumb {
          position: absolute;
          top: 3px;
          bottom: 3px;
          border-radius: 999px;
          background: ${ACCENT};
          box-shadow: 0 2px 8px rgba(108,123,224,0.35);
          transition: transform 0.26s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .export-format-toggle button {
          position: relative;
          z-index: 1;
          flex: 1;
          background: transparent;
          transition: color 0.2s ease;
        }
        /* 數字字體橫向捲動選單：隱藏卷軸但保留可捲動手感（webkit／Firefox 都處理） */
        .font-scroll::-webkit-scrollbar { display: none; }
        .font-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        /* 背景圖片深淺判定完成、cardInk／cardInkSoft 切換深色或白色文字時，
           讓顏色本身平滑過渡，而不是瞬間跳色；只影響 color（文字／icon），不影響背景或版面。 */
        .card-ink-fade, .card-ink-fade * {
          transition: color 260ms ease;
        }
      `}</style>
      <div
        className={dock ? 'relative w-full h-full rounded-3xl' : 'relative w-full max-w-sm max-h-[85vh] rounded-3xl'}
        style={{
          opacity: shown ? 1 : 0,
          // dock（分欄右側面板）模式下改成從右邊帶點彈性地「彈射」滑入；非 dock（手機置中彈窗）維持原本由下往上彈出的效果
          transform: shown
            ? 'scale(1) translateX(0px) translateY(0px)'
            : dock ? 'scale(0.94) translateX(28px) translateY(0px)' : 'scale(0.92) translateX(0px) translateY(14px)',
          transition: `opacity ${CLOSE_DURATION}ms ease, transform ${CLOSE_DURATION}ms cubic-bezier(0.34, 1.28, 0.64, 1)`,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 自訂背景圖片：最底層。圖片本身完全不跟著滑桿改變透明度。 */}
        {ev.bgImage && (
          <img
            src={ev.bgImage}
            alt=""
            className="absolute inset-0 w-full h-full rounded-3xl"
            style={{
              objectFit: 'cover',
              zIndex: 0,
              display: 'block',
            }}
          />
        )}

        {/* 玻璃效果層：正常模式固定輕度模糊；點擊「原圖」按鈕進入原圖模式後，整層完全移除。 */}
        {ev.bgImage && !glassCleared && (
          <div
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{
              zIndex: 1,
              backdropFilter: 'blur(10px) saturate(180%)',
              WebkitBackdropFilter: 'blur(10px) saturate(180%)',
            }}
          />
        )}

        {/* 唯一受滑桿控制的遮罩：滑桿數值 0～100 對應遮罩從完全不透明到完全消失。
            遮罩顏色跟著 App 的深色／淺色模式走（淺色模式白色、深色模式改用跟匯出圖片
            buildEventCardCanvas 同一個深色 rgba(20,22,28,...)）——原本這裡固定寫死白色，
            深色模式切換對這個預覽視窗完全沒有視覺差異，只有匯出的圖片才看得出深色遮罩，
            兩邊不一致。現在預覽跟匯出用同一組顏色，深色模式下也能在這裡直接看到遮罩變化。
            拖動滑桿當下不套用 transition，讓遮罩即時跟著手指變化，不會因為每個畫格都在追
            前一個還沒播完的 90ms 轉場而看起來delay／卡頓；放開手指、或透過按鈕（例如「原圖」）
            觸發的變化才套用平滑轉場。 */}
        {ev.bgImage && !glassCleared && (
          <div
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{
              zIndex: 2,
              background: isDark ? `rgba(20,22,28,${displayBgOpacity})` : `rgba(255,255,255,${displayBgOpacity})`,
              transition: sliderDragging ? 'none' : 'background 90ms linear',
            }}
          />
        )}

        {/* 沒有背景圖片時的毛玻璃底色：獨立成一層「不隨內容捲動」的絕對定位圖層，
            不要把 backdrop-filter 直接加在下面那個會捲動、又處於父層開合動畫 transform 之下
            的內容層上——這個組合在手機瀏覽器上，手指拖動（捲動）當下很容易讓模糊層跟丟、
            看起來像整塊內容瞬間跑位。獨立成一層之後，捲動只會捲動內容本身，這層毛玻璃底色
            固定不動，就不會再跟著跑位。 */}
        {!ev.bgImage && (
          <div
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{
              zIndex: 2,
              background: `rgba(255,255,255,${NO_IMAGE_CARD_OPACITY})`,
              backdropFilter: AUTH_GLASS.backdropFilter,
              WebkitBackdropFilter: AUTH_GLASS.WebkitBackdropFilter,
            }}
          />
        )}

        <div className={(dock ? 'relative w-full h-full overflow-y-auto rounded-3xl p-5 flex flex-col' : 'relative w-full max-h-[85vh] overflow-y-auto rounded-3xl p-5 flex flex-col') + ' card-ink-fade'} style={{
          ...AUTH_GLASS,
          // 內容層本身永遠保持透明、不帶 backdrop-filter；不管有沒有背景圖片，
          // 毛玻璃／模糊效果一律交給上面各自獨立的靜態圖層負責，內容層只負責捲動。
          background: 'transparent',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          zIndex: 3,
          overscrollBehavior: 'contain',
          touchAction: 'pan-y',
          // 拖動透明度滑桿時暫時鎖住這層本身的捲動：手指按在滑桿上、只要有一點點垂直位移，
          // 瀏覽器原生就可能把它判讀成「捲動這層」的手勢，導致文字內容跟著滑桿一起跑位。
          // 拖動期間直接關閉捲動，放開後才恢復，滑桿操作跟文字內容就完全不會互相干擾。
          overflowY: sliderDragging ? 'hidden' : 'auto',
        }}>
          {/* 有自訂背景時不再疊加額外彩色光暈，避免遮住背景圖片；沒有背景時才保留原本的柔光。 */}
          {!ev.bgImage && (
            <>
              <div className="absolute pointer-events-none" style={{ width: '55%', aspectRatio: '1', top: '-18%', right: '-15%', background: `${colorHex(ev.colorId)}22`, filter: 'blur(50px)', borderRadius: '50%', zIndex: 0 }} />
              <div className="absolute pointer-events-none" style={{ width: '45%', aspectRatio: '1', bottom: '-12%', left: '-12%', background: `${colorHex(ev.colorId)}15`, filter: 'blur(50px)', borderRadius: '50%', zIndex: 0 }} />
            </>
          )}

          {/* 左上角：事件圖示＋標題／日期，樣式比照倒數卡片設計 */}
          <div className="w-full flex items-start justify-between gap-2 relative" style={{ zIndex: 1 }}>
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="flex items-center justify-center flex-shrink-0 rounded-2xl"
                style={{ width: 46, height: 46, background: `${colorHex(ev.colorId)}1c`, fontSize: 22, boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.6)' }}
              >
                {ev.icon}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-bold truncate" style={{ color: cardInk, fontSize: 17, letterSpacing: '-0.01em' }}>{ev.title}</h3>
                  {/* 生日徽章：XX歲生日，緊跟在事件名稱後面 */}
                  {ev.age !== null && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: `${colorHex(ev.colorId)}20`, color: colorHex(ev.colorId) }}>
                      {ev.isCare ? t.anniversaryBadge(ev.age) : t.ageBadge(ev.age)}
                    </span>
                  )}
                </div>
                <p className="text-xs truncate mt-0.5" style={{ color: cardInkSoft }}>{dateStr}</p>
              </div>
            </div>
            <button onClick={handleClose} aria-label={t.close} style={{ color: cardInkSoft, flexShrink: 0 }}><X size={18} /></button>
          </div>

          {/* 次要標籤：顏色標記／生日／關懷／農曆日期，統一做成徽章樣式；年齡與週年只保留在標題旁。 */}
          <div className="flex items-center gap-2 flex-wrap mt-2 relative" style={{ zIndex: 1 }}>
            <span className="inline-flex items-center gap-1 text-xs font-bold flex-shrink-0" style={{ color: cardInkSoft }}>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colorHex(ev.colorId) }} />
              {t.markerColorLabel}
            </span>
            {ev.isBirthday ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold flex-shrink-0" style={{ background: accentAlpha('20'), color: ACCENT, border: `1px solid ${accentAlpha('22')}` }}>{t.birthdayLabel}</span>
            ) : ev.isCare ? (
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold flex-shrink-0"
                style={{
                  background: `${colorHex(ev.colorId)}18`,
                  color: colorHex(ev.colorId),
                  border: `1px solid ${colorHex(ev.colorId)}22`,
                }}
              >
                {t.careLabel}
              </span>
            ) : null}
            {/* 年齡／週年徽章只保留在事件名稱右側，避免詳情卡片重複顯示。 */}
            {/* 開啟循環後，詳情卡片不再額外顯示「每年／每月」頻率文字；循環本身已由模式／事件資訊表達。 */}
            {altCalendarStr && (
              // 關懷模式的事件：曆法徽章改用事件本身的顏色（呼應「關懷」徽章與圖示色塊），
              // 不再套用強調色 ACCENT；其餘模式維持原本的 ACCENT 樣式不變。
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                style={{
                  background: ev.isCare ? `${colorHex(ev.colorId)}20` : accentAlpha('20'),
                  color: ev.isCare ? colorHex(ev.colorId) : ACCENT,
                }}
              >
                {altCalendarStr}
              </span>
            )}
          </div>

          {/* 中央超大剩餘天數，樣式比照倒數卡片設計：大數字＋兩側分隔線的說明文字（數字再放大一階）。
              不透明度固定 100%（漸層兩端改用同一個全不透明顏色，純粹做出角度光澤感，不再讓文字本身透出底色）；
              字級則依數字位數動態縮放——位數越多，單一數字就越小，確保長數字不會被卡片寬度截斷或擠壓變形。 */}
          <div className="flex flex-col items-center justify-center relative" style={{ zIndex: 1, padding: '38px 0 26px' }}>
            <div
              style={{
                fontSize: bigNumberFontSize,
                lineHeight: 0.85,
                fontWeight: 500,
                letterSpacing: '-0.04em',
                fontFamily: isTodayTextMessage ? todayTextFontFamily : numberFontFamily,
                fontVariationSettings: isTodayTextMessage && isZh ? 'normal' : numberFontVariation,
                background: `linear-gradient(135deg, ${colorHex(ev.colorId)}, ${colorHex(ev.colorId)})`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                opacity: 1,
                filter: `drop-shadow(0 8px 20px ${colorHex(ev.colorId)}33)`,
                transition: 'font-family 0.15s ease, font-size 0.15s ease',
              }}
            >
              {bigNumberDisplay}
            </div>
            <div className="flex items-center gap-4 mt-3" style={{ color: cardInkSoft, fontSize: 14, fontWeight: 500 }}>
              <span style={{ width: 30, height: 1, background: 'var(--card-border)' }} />
              <span>{isCompanionMode
                ? t.companionDays(Math.max(0, ev.elapsedDays ?? 0))
                : ev.diffDays === 0 ? t.today : ev.diffDays > 0 ? t.daysLeft(ev.diffDays) : t.daysAgo(Math.abs(ev.diffDays))}</span>
              <span style={{ width: 30, height: 1, background: 'var(--card-border)' }} />
            </div>
          </div>

          {showOrigDate && (
            <div className="p-3 rounded-xl relative" style={{ background: CARD_BG, border: CARD_BORDER, zIndex: 1 }}>
              <div className="text-xs" style={{ color: INK_SOFT }}>{t.originalDate}：{origDateStr}</div>
            </div>
          )}

          {/* 二級功能列：「自訂」（齒輪＋文字）收合卡片背景／數字字體等次要設定；
              「分享」icon 按鈕維持在同一排、獨立展開匯出面板 */}
          <div className="mt-5 pt-4 flex items-center gap-2 relative" style={{ borderTop: CARD_BORDER, zIndex: 1 }}>
            <button
              onClick={() => setShowCustomizePanel(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold flex-shrink-0"
              style={{ background: showCustomizePanel ? ACCENT : 'var(--card-border)', color: showCustomizePanel ? '#fff' : cardInkSoft }}
            >
              <Settings size={15} />
              {t.customizeLabel}
            </button>
            {/* 匯出成圖片：獨立 icon 按鈕，點了展開下方的格式選擇＋分享面板 */}
            <button
              onClick={() => setShowExportPanel(v => !v)}
              aria-label={t.exportLabel}
              title={t.exportLabel}
              className="p-2 rounded-lg flex items-center justify-center flex-shrink-0 ml-auto"
              style={{ background: showExportPanel ? ACCENT : 'var(--card-border)', color: showExportPanel ? '#fff' : cardInkSoft, width: '2.25rem', height: '2.25rem' }}
            >
              <Share2 size={15} />
            </button>
          </div>

          {/* 「自訂」二級面板：預設收合，點擊齒輪按鈕後視窗縱向加長展開，
              裡面包含「更換卡片背景」與「更換數字字體」兩個欄目 */}
          <div
            className="relative"
            style={{
              zIndex: 1,
              maxHeight: showCustomizePanel ? 640 : 0,
              opacity: showCustomizePanel ? 1 : 0,
              marginTop: showCustomizePanel ? 14 : 0,
              overflow: 'hidden',
              transition: 'max-height 180ms cubic-bezier(0.22, 1, 0.36, 1), opacity 130ms ease, margin-top 160ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {/* 更換卡片背景：上傳／更換／移除，圖片會先在瀏覽器端等比縮小再存起來，避免佔用太多空間 */}
            <div className="pb-4" style={{ borderBottom: CARD_BORDER }}>
              <div className="text-xs font-bold mb-2" style={{ color: cardInkSoft }}>{t.customBgLabel}</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  disabled={uploading}
                  className="px-4 py-2 rounded-lg text-sm font-bold flex-shrink-0"
                  style={{ background: MINT, color: '#fff', opacity: uploading ? 0.6 : 1 }}
                >
                  {uploading ? t.customBgUploading : ev.bgImage ? t.customBgChange : t.customBgUpload}
                </button>
                {ev.bgImage && !uploading && (
                  <>
                    <button
                      onClick={() => onSetBgImage(null)}
                      className="px-3 py-2 rounded-lg text-sm font-bold flex-shrink-0"
                      style={{ background: 'rgba(255,0,74,0.12)', color: DANGER }}
                    >
                      {t.customBgRemove}
                    </button>
                    {/* 調節按鈕：切換下方「調節透明度」面板的展開／收合 */}
                    <button
                      onClick={() => setShowOpacityAdjust(v => !v)}
                      aria-label={t.adjustBgOpacity}
                      title={t.adjustBgOpacity}
                      className="p-2 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: showOpacityAdjust ? ACCENT : 'var(--card-border)', color: showOpacityAdjust ? '#fff' : cardInkSoft, width: '2.25rem', height: '2.25rem' }}
                    >
                      <SlidersHorizontal size={15} />
                    </button>
                  </>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              {bgError && <p className="text-xs font-medium mt-2" style={{ color: DANGER }}>{bgError}</p>}

              {/* 調節透明遮罩面板：只有設定過自訂背景圖片時才可能展開，
                  用 max-height + opacity 過渡讓視窗高度變化看起來絲滑，而不是瞬間跳動 */}
              {ev.bgImage && (
                <div
                  style={{
                    maxHeight: showOpacityAdjust ? 92 : 0,
                    opacity: showOpacityAdjust ? 1 : 0,
                    marginTop: showOpacityAdjust ? 14 : 0,
                    overflow: 'hidden',
                    transition: 'max-height 170ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease, margin-top 220ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                >
                  <div className="text-xs font-bold mb-2" style={{ color: cardInkSoft }}>
                    {t.dragToAdjustOpacity}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1" style={{ paddingTop: 26 }}>
                      {/* 拖動滑桿時，在滑塊正上方浮出目前的透明度數值（0～100），放開才收起；
                          顏色跟隨路標色，字級也放大一些，拖動時更容易一眼看清楚。
                          用 localSliderValue（零延遲）而不是 overlaySliderValue（被節流過），
                          數值氣泡才會跟滑塊、跟手指完全同步，不會有一瞬間的落後感。 */}
                      {sliderDragging && !glassCleared && (
                        <span
                          aria-hidden="true"
                          style={{
                            position: 'absolute',
                            left: `${localSliderValue}%`,
                            transform: 'translateX(-50%)',
                            top: 0,
                            fontSize: 15,
                            fontWeight: 800,
                            color: '#fff',
                            background: colorHex(ev.colorId),
                            padding: '4px 11px',
                            borderRadius: 9,
                            minWidth: 30,
                            textAlign: 'center',
                            boxShadow: '0 3px 10px rgba(0,0,0,0.18)',
                            pointerEvents: 'none',
                            whiteSpace: 'nowrap',
                          }}
                        >{localSliderValue}</span>
                      )}
                      <input
                        type="range"
                        min={0}
                        max={SLIDER_MAX}
                        step={1}
                        value={localSliderValue}
                        disabled={glassCleared}
                        onMouseDown={() => setSliderDragging(true)}
                        onTouchStart={() => setSliderDragging(true)}
                        onChange={e => {
                          // 滑塊視覺（value）跟數值氣泡都改用這份本地 state，每個原生事件都立即
                          // 更新，完全跟手指同步；真正觸發整個視窗重新渲染的 onSetBgOpacity 才用
                          // requestAnimationFrame 節流到最多每畫格一次，避免事件堆積、拖慢渲染。
                          const sliderValue = Number(e.target.value);
                          setLocalSliderValue(sliderValue);
                          if (sliderRafRef.current) cancelAnimationFrame(sliderRafRef.current);
                          sliderRafRef.current = requestAnimationFrame(() => {
                            onSetBgOpacity(1 - sliderValue / SLIDER_MAX);
                          });
                        }}
                        className="w-full premium-range"
                        aria-label={t.adjustBgOpacity}
                        style={{
                          // 底色跟隨路標色：已調整部分用路標色實色，未調整部分用路標色的淺色調，
                          // 不再是跟路標色無關的固定灰色。
                          background: `linear-gradient(to right, ${colorHex(ev.colorId)} 0%, ${colorHex(ev.colorId)} ${localSliderValue}%, ${colorHex(ev.colorId)}2A ${localSliderValue}%, ${colorHex(ev.colorId)}2A 100%)`,
                          opacity: glassCleared ? 0.4 : 1,
                          // 拖動當下把整條軌道的觸控手勢鎖定成只能水平拖動，不會被瀏覽器誤判成
                          // 想要垂直捲動頁面，這樣才不會出現「明明在拖滑桿，畫面卻跟著晃」的狀況。
                          touchAction: 'none',
                        }}
                      />
                    </div>
                    {/* 「原圖」：獨立的長條形按鈕，取代原本滑桿裡 100～120 那段隱藏區間。
                        點一下切換成原圖模式（不模糊、不加遮罩）；再點一下則還原成切換前的透明度。
                        未選中時也給一層半透明毛玻璃底色＋細邊框，避免疊在照片上時存在感太弱、被忽略。 */}
                    <button
                      type="button"
                      onClick={toggleOriginalImage}
                      className="flex-shrink-0 rounded-full text-xs font-bold"
                      style={{
                        padding: '7px 14px',
                        background: glassCleared ? ACCENT : 'rgba(255,255,255,0.3)',
                        border: glassCleared ? '1px solid transparent' : '1px solid rgba(255,255,255,0.45)',
                        backdropFilter: glassCleared ? 'none' : 'blur(8px)',
                        WebkitBackdropFilter: glassCleared ? 'none' : 'blur(8px)',
                        boxShadow: glassCleared ? 'none' : '0 2px 8px rgba(0,0,0,0.1)',
                        color: glassCleared ? '#fff' : cardInkSoft,
                        // 滑桿外層容器上方留了一段 paddingTop 給拖動時彈出的數值氣泡用，
                        // 用 items-center 對齊整個外層容器高度的話，這顆按鈕會偏高、對不準滑桿軌道
                        // 真正的位置，這裡往下推一點，讓按鈕的中心軸線對齊左側滑桿軌道的中心。
                        marginTop: 14,
                        transition: 'background 120ms ease, color 120ms ease',
                      }}
                    >
                      {originalImageLabel}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 更換數字字體：橫向可捲動的字卡（方案 A＋B 合併）——每張卡直接用該字體渲染樣本數字，
                一眼看出實際效果，同時用橫向捲動不佔垂直空間，未來要加更多字體只要往 NUMBER_FONTS 加項目即可 */}
            <div className="pt-4">
              {/* 標題列跟下面「可橫向捲動」的字體清單是分開的兩個區塊：ⓘ 按鈕緊貼在「數字字體」文字右邊，
                  不在 overflow-x-auto 容器裡面，所以捲動字體清單時 ⓘ 一定固定在標題旁，不會被一起捲走 */}
              <div className="flex items-center gap-1 mb-2">
                <div className="text-xs font-bold" style={{ color: cardInkSoft }}>{t.customFontLabel}</div>
                <button
                  type="button"
                  onClick={() => setShowFontInfo(v => !v)}
                  aria-expanded={showFontInfo}
                  className="flex-shrink-0"
                  style={{ fontSize: 14, lineHeight: 1, color: cardInkSoft, opacity: 0.5, padding: 2, background: 'transparent', border: 'none' }}
                >
                  ⓘ
                </button>
              </div>
              <div className="font-scroll flex items-center gap-2.5 overflow-x-auto pb-1">
                {NUMBER_FONTS.map(f => {
                  const active = numberFontId === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => onSetNumberFont(f.id)}
                      className="relative flex flex-col items-center justify-center rounded-2xl flex-shrink-0"
                      style={{
                        width: 68, height: 68,
                        background: active ? `${colorHex(ev.colorId)}18` : CARD_BG,
                        border: active ? `1.5px solid ${colorHex(ev.colorId)}` : CARD_BORDER,
                        transition: 'border-color 0.15s ease, background 0.15s ease',
                      }}
                    >
                      {active && (
                        <span
                          className="absolute flex items-center justify-center rounded-full"
                          style={{ top: 4, right: 4, width: 14, height: 14, background: colorHex(ev.colorId), color: '#fff', fontSize: 8, fontWeight: 900 }}
                        >
                          ✓
                        </span>
                      )}
                      <span style={{ fontFamily: f.family, fontVariationSettings: f.variationSettings || 'normal', fontSize: 22, fontWeight: 700, lineHeight: 1, color: cardInk }}>88</span>
                      <span className="mt-1.5" style={{ fontSize: 9, fontWeight: 700, color: cardInkSoft }}>{f.name}</span>
                    </button>
                  );

                })}
              </div>
            </div>
          </div>

          {/* 匯出成圖片面板：點右上角分享 icon 展開 */}
          <div
            className="relative"
            style={{
              zIndex: 1,
              maxHeight: showExportPanel ? 160 : 0,
              opacity: showExportPanel ? 1 : 0,
              marginTop: showExportPanel ? 14 : 0,
              overflow: 'hidden',
              transition: 'max-height 170ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease, margin-top 220ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <div className="text-xs font-bold mb-2" style={{ color: cardInkSoft }}>{t.exportLabel}</div>
            {/* 「卡片／限動(9:16)」格式選擇：改成會滑動的膠囊開關，一整條寬度切一半，
                選中的一側用會平滑滑動的實心背景表示，比原本兩顆各自變色的按鈕更有質感 */}
            <div className="export-format-toggle mb-3">
              <div
                className="toggle-thumb"
                style={{ left: 3, right: '50%', transform: exportFormat === 'story' ? 'translateX(100%)' : 'translateX(0%)' }}
              />
              <button
                onClick={() => setExportFormat('card')}
                className="px-3 py-2 rounded-full text-sm font-bold"
                style={{ color: exportFormat === 'card' ? '#fff' : cardInkSoft }}
              >
                {t.exportFormatCard}
              </button>
              <button
                onClick={() => setExportFormat('story')}
                className="px-3 py-2 rounded-full text-sm font-bold"
                style={{ color: exportFormat === 'story' ? '#fff' : cardInkSoft }}
              >
                {t.exportFormatStory}
              </button>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full px-3 py-2.5 rounded-lg text-sm font-bold"
              style={{ background: ACCENT, color: '#fff', opacity: exporting ? 0.6 : 1 }}
            >
              {exporting ? t.exportPreparing : t.exportShareButton}
            </button>
            {exportError && <p className="text-xs font-medium mt-2" style={{ color: DANGER }}>{exportError}</p>}
          </div>
        </div>

        {/* 字體授權補充說明：改成直接蓋在整張事件詳情卡片上的浮層，而不是把卡片內容往下撐開；
            點 ⓘ 展開、點右上角 X 或浮層外圍空白處收合。點「查看授權資訊」時關掉本浮層、
            改開下面的完整條款彈窗，兩層一次只會出現一層，不會疊在一起。 */}
        {fontInfoMounted && (
          <div
            className="absolute inset-0 rounded-3xl flex flex-col card-ink-fade"
            style={{
              zIndex: 40,
              ...AUTH_GLASS,
              background: ev.bgImage ? 'rgba(255,255,255,0.82)' : AUTH_GLASS.background,
              opacity: fontInfoShown ? 1 : 0,
              transform: fontInfoShown ? 'scale(1)' : 'scale(0.97)',
              transition: 'opacity 120ms ease, transform 120ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
            onClick={() => setShowFontInfo(false)}
          >
            <div
              className="w-full h-full overflow-y-auto p-5 flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <h3 className="text-sm font-black" style={{ color: INK }}>{t.customFontLabel}</h3>
                <button onClick={() => setShowFontInfo(false)} aria-label={t.close} style={{ color: INK_SOFT, flexShrink: 0 }}><X size={18} /></button>
              </div>
              <div className="text-xs leading-relaxed" style={{ color: INK_SOFT }}>
                <p className="mb-2">{t.fontLicenseIntro}</p>
                <div className="mb-2" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {NUMBER_FONTS.map(f => (
                    <div key={f.id} className="flex items-baseline justify-between gap-3">
                      <span style={{ fontWeight: 700, color: INK, flexShrink: 0 }}>{f.name}</span>
                      <span style={{ opacity: 0.85, textAlign: 'right' }}>{f.copyright}</span>
                    </div>
                  ))}
                </div>
                <p className="mb-2">{t.fontLicenseAllNote}</p>
                <button
                  type="button"
                  onClick={() => {
                    // 不能在同一個事件處理常式裡「同時」關掉這層小面板、又打開授權彈窗：
                    // 兩層都用 useModalBackClose 管理瀏覽器返回鍵，各自靠 pushState／history.back()
                    // 模擬一層「可以按上一頁關閉」的堆疊。關閉小面板時會呼叫 history.back()，
                    // 但瀏覽器實際觸發對應的 popstate 事件是非同步的；如果在它還沒觸發前，
                    // 授權彈窗那邊的 effect 就搶先呼叫 pushState 推了一個新的紀錄上去，
                    // 等小面板那次 back() 真正生效時，瀏覽器目前所在的位置已經是「授權彈窗」推上去
                    // 的那一筆——實測在 Android Chrome 上這樣會導致授權彈窗剛打開又被那次遲來的
                    // popstate 影響、或者瀏覽器的返回堆疊跟 App 自己記錄的堆疊對不上，
                    // 使用者之後再操作（例如按返回鍵關掉彈窗）時，就可能多退了一層，
                    // 直接跳出整個網站。改成延後一個 tick 才開啟授權彈窗，
                    // 讓小面板的關閉（含它自己的 history.back()）先完全處理完，
                    // 兩邊的 push／back 就不會疊在同一輪事件迴圈裡互相搶。
                    setShowFontInfo(false);
                    setTimeout(() => setShowFontLicenseModal(true), 0);
                  }}
                  style={{ fontWeight: 700, color: colorHex(ev.colorId), background: 'transparent', border: 'none', padding: 0, textDecoration: 'underline' }}
                >
                  {t.fontLicenseViewFull} →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    {/* 字體授權完整條款：獨立用 createPortal 掛到 document.body，蓋在最上層（比地標詳情視窗本身
        z-index 更高），這樣才不會被地標詳情卡片本身 overflow 影響顯示，點外部空白處即可關閉。
        background／內層卡片都各自套 opacity+transform 轉場，跟浮層淡出的時間點重疊，
        看起來像浮層被彈窗接手蓋過去，而不是兩個視窗生硬地互相跳接。 */}
    {fontLicenseMounted && createPortal(
      <div
        className="fixed inset-0 flex items-center justify-center px-6"
        style={{
          zIndex: 260,
          background: fontLicenseShown ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
          transition: 'background 130ms ease',
        }}
        onClick={() => setShowFontLicenseModal(false)}
      >
        <div
          className={`w-full ${dock ? 'max-w-md' : 'max-w-sm'} rounded-2xl flex flex-col`}
          style={{
            ...AUTH_GLASS,
            maxHeight: '80vh',
            opacity: fontLicenseShown ? 1 : 0,
            transform: fontLicenseShown ? 'scale(1) translateY(0px)' : 'scale(0.94) translateY(10px)',
            transition: 'opacity 130ms ease, transform 130ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
            <h2 className="text-base font-black" style={{ color: INK }}>{t.fontLicenseModalTitle}</h2>
            <button onClick={() => setShowFontLicenseModal(false)} aria-label={t.close} style={{ color: INK_SOFT }}><X size={18} /></button>
          </div>
          <div className="px-5 pb-5 overflow-y-auto text-xs leading-relaxed" style={{ color: INK }}>
            <div className="mb-3" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {NUMBER_FONTS.map(f => (
                <div key={f.id} className="flex items-baseline justify-between gap-3">
                  <span style={{ fontWeight: 700, flexShrink: 0 }}>{f.name}</span>
                  <span style={{ color: INK_SOFT, textAlign: 'right' }}>{f.copyright}</span>
                </div>
              ))}
            </div>
            <p className="mb-3 font-bold">{t.fontLicenseAllNote}</p>
            <h3 className="text-xs font-black mb-2">{t.fontLicenseFullTextTitle}</h3>
            <pre className="whitespace-pre-wrap mb-3" style={{ fontFamily: 'inherit', color: INK_SOFT, fontSize: 11 }}>{SIL_OFL_1_1_TEXT}</pre>
            {/* 這裡是既有的另一個小問題，跟這次移除 portal 的改動無關：INK 本來就是 CSS 變數
                （'var(--ink)'），接兩位 hex 尾碼做透明度一樣是無效的 CSS 值，分隔線會直接消失。
                順手一併修掉，改用 color-mix()。 */}
            <div className="pt-3" style={{ borderTop: `1px solid color-mix(in srgb, ${INK} 10%, transparent)` }}>
              <p className="mb-1" style={{ color: INK_SOFT }}>{t.fontLicenseSourceLabel}: Google Fonts</p>
              <a
                href="https://fonts.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontWeight: 700, color: ACCENT, textDecoration: 'underline' }}
              >
                {t.fontLicenseViewSource} ↗
              </a>
            </div>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
}
