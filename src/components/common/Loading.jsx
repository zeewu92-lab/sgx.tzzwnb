import { useState } from 'react';

export const SHOW_TEST_WATERMARK = false;

export const TEST_WATERMARK_TEXT = '測試版080207';

export function Watermark() {
  return (
    <div
      className="fixed bottom-2.5 right-3 select-none"
      style={{ zIndex: 9999, fontSize: 11, fontWeight: 600, letterSpacing: 0.2, color: 'rgba(120,124,138,0.4)', pointerEvents: 'none' }}
    >
      @zhaoziwuofficial
    </div>
  );
}

export function formatWatermarkAccessTime(date) {
  const pad = n => String(n).padStart(2, '0');
  const y = date.getFullYear(), mo = pad(date.getMonth() + 1), d = pad(date.getDate());
  const h = pad(date.getHours()), mi = pad(date.getMinutes()), s = pad(date.getSeconds());
  let zoneSuffix = '';
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offsetMin = -date.getTimezoneOffset(); // 分鐘數，正值代表比 UTC 快
    const sign = offsetMin >= 0 ? '+' : '-';
    const oh = pad(Math.floor(Math.abs(offsetMin) / 60));
    const om = pad(Math.abs(offsetMin) % 60);
    zoneSuffix = ` ${tz} UTC${sign}${oh}:${om}`;
  } catch (e) {}
  return `${y}-${mo}-${d} ${h}:${mi}:${s}${zoneSuffix}`;
}

export function TestVersionWatermark() {
  // 只在元件第一次掛載（也就是這次訪問／渲染）時取一次時間，之後不再更新，
  // 代表「使用者這次打開／整頁重新渲染時，系統時區當下的標準時間」。
  const [accessTime] = useState(() => formatWatermarkAccessTime(new Date()));
  const watermarkText = `${TEST_WATERMARK_TEXT} ${accessTime}`;
  const rows = 10;
  const cols = 4;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push(
        <span
          key={`${r}-${c}`}
          className="select-none whitespace-nowrap"
          style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.3, color: 'rgba(45,45,48,0.06)' }}
        >
          {watermarkText}
        </span>
      );
    }
  }
  return (
    // zIndex 為負值：讓浮水印疊在正常文件流內容「之下」（置底），不會蓋住卡片、按鈕等 UI
    <div className="fixed inset-0 overflow-hidden" style={{ zIndex: -1, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: '-30%',
          left: '-30%',
          width: '160%',
          height: '160%',
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridAutoRows: '110px',
          placeItems: 'center',
          transform: 'rotate(-28deg)',
        }}
      >
        {cells}
      </div>
    </div>
  );
}
