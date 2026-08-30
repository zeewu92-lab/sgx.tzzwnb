// 「時光線」新圖示設計方案裡的兩個自訂圖示：世界時鐘（地球＋時鐘）、語言（A／文）。
// 取代原本共用 lucide-react 的 Globe 圖示（世界時鐘分頁／底部導航、語言切換兩處原本用同一個
// 地球圖示，語意上其實不太夠精準，這兩個圖示分開後語意更清楚）。
//
// Props 介面刻意跟 lucide-react 的圖示元件一致（size／strokeWidth／className／style），
// 這樣原本 `<Icon size={20} style={{ color }} strokeWidth={...} />` 的呼叫方式完全不用改，
// 是可以直接替換的 drop-in 元件。常規／選中／停用三種狀態不用額外邏輯——
// 跟 lucide 圖示一樣靠外層傳進來的顏色（currentColor）決定，圖示本身不管狀態。
//
// 規範網格：24×24px，線寬預設 2px，圓角線條（strokeLinecap/strokeLinejoin 都用 round），
// 縮到 16×16px 也依然清晰可辨。

export function WorldClockIcon({ size = 24, strokeWidth = 2, className, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      {/* 地球：外框圓＋一條橫向緯線＋一條縱向經線弧，主體偏左上，右下角留給時鐘 */}
      <circle cx="10" cy="10" r="7.25" />
      <path d="M2.75 10h14.5" />
      <path d="M10 2.75c2.1 1.9 3.3 4.6 3.3 7.25s-1.2 5.35-3.3 7.25c-2.1-1.9-3.3-4.6-3.3-7.25S7.9 4.65 10 2.75z" />
      {/* 時鐘：疊在地球右下角，錶面用背景色挖空，蓋掉底下經緯線，看起來像獨立的錶面 */}
      <circle cx="17" cy="17" r="5.5" fill="var(--card-bg, #fff)" />
      <circle cx="17" cy="17" r="5.5" />
      <path d="M17 14.3V17l1.8 1.4" />
    </svg>
  );
}

export function LanguageIcon({ size = 24, strokeWidth = 2, className, style }) {
  // 「A」「文」用 <text> 直接吃系統字型渲染，而不是手畫筆畫路徑——中文字筆畫細節多，
  // 手畫的路徑座標沒辦法在這裡實際預覽校對，用 <text> 讓瀏覽器自己的字型引擎處理，
  // 才能保證兩個字在小尺寸下依然清楚可讀，不會糊成一團看不出來是什麼字。
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={style}
    >
      <text x="1.5" y="17" fontSize="11" fontWeight="800" fontFamily="'Quicksand', system-ui, sans-serif" fill="currentColor">文</text>
      <path d="M12.3 19 15.2 3.5" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <text x="14.8" y="18.5" fontSize="13" fontWeight="700" fontFamily="system-ui, sans-serif" fill="currentColor">A</text>
    </svg>
  );
}
