import { useState, useEffect, useRef } from 'react';
import { EVENT_CARD_GAP } from './Timeline.jsx';

export function PastEventsAnimatedSection({ show, events, renderEventCard }) {
  const contentRef = useRef(null);
  const [height, setHeight] = useState(0);

  // 量測內容高度：只有在「展開」狀態才把量到的高度套用回 state。
  // 修正前這裡不論目前是否展開都會呼叫 measure()，而 ResizeObserver 第一次的回呼
  // 是非同步的，常常會晚於下面「收合」那個 effect 才觸發，導致每次進入頁面（元件重新掛載、
  // events.length 改變）都被非同步地重新展開成完整高度，即使 showPast 其實是 false，
  // 也因此在畫面上「自動預留」出一大塊看不見但仍佔位的空白區域。收合時完全不採用量到的高度，
  // 就不會再發生這個問題。
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => { if (show) setHeight(el.scrollHeight); };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, [events.length, show]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (show) {
      requestAnimationFrame(() => setHeight(el.scrollHeight));
    } else {
      setHeight(0);
    }
  }, [show]);

  // 圓點指示器靠負 left 位移「掛」在軸線上，最左會超出卡片本身的邊界約 25px。
  // CSS 規定只要 overflow-x／overflow-y 其中一個是 hidden、另一個是 visible，
  // visible 那一軸會被瀏覽器強制轉成 auto——而 auto 一樣會把超出範圍的內容裁掉，
  // 並不會真的「可見」，這就是圓點完全消失的原因。改成左側額外留一段 padding
  // （比圓點超出的量再寬一點）＋等量的負 margin 抵銷位置，讓圓點落在裁切框「裡面」，
  // 這樣兩軸都可以放心用同一個 overflow: hidden，圓點也不會再被裁掉。
  const DOT_SAFE_INSET = 30;

  return (
    <div
      className="relative"
      style={{
        height,
        opacity: show ? 1 : 0,
        // 展開時在區塊下方留出跟「事件卡片與卡片之間」一致的間距，銜接下方的未來地標清單；
        // 收合時完全不佔位，維持跟按鈕之間原本的間距。
        marginBottom: show ? EVENT_CARD_GAP : 0,
        marginLeft: -DOT_SAFE_INSET,
        paddingLeft: DOT_SAFE_INSET,
        transform: show ? 'translateY(0)' : 'translateY(-6px)',
        pointerEvents: show ? 'auto' : 'none',
        overflow: 'hidden',
        transition: 'height 160ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 110ms ease, transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1), margin-bottom 160ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        willChange: 'height, opacity, transform',
      }}
    >
      {/* flex + gap 統一控制卡片間距，不再依賴每張卡片自己的 margin-bottom——
          margin 在「最後一張卡片」是否會被父層 scrollHeight 量進去，不同瀏覽器行為不一致，
          容易導致收合區塊跟下方未來地標之間的間隙忽大忽小；gap 不會有這個問題。 */}
      <div ref={contentRef} className="relative flex flex-col" style={{ zIndex: 0, gap: EVENT_CARD_GAP }}>
        {events.map(renderEventCard)}
      </div>
    </div>
  );
}
