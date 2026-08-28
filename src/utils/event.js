import { addDays, addMonths, addYears, combineDateTime, isDateBeforeToday } from './date.js';
import { findNextCalendarMatch, findNextChineseMatch, getCalendarParts, getChineseDateInfo } from './lunar.js';

export function getEffectiveDate(ev, now) {
  const orig = combineDateTime(ev.date, ev.time);
  if (!ev.repeat) return orig;
  const lunarLocked = ev.repeatUnit === 'year' && ev.calendar && ev.calendar !== 'gregory';
  const n = lunarLocked ? 1 : Math.max(1, ev.repeatInterval || 1);

  if (ev.repeatUnit === 'month') {
    let cand = new Date(orig);
    while (isDateBeforeToday(cand, now)) cand = addMonths(cand, n);
    return cand;
  }
  if (!ev.calendar || ev.calendar === 'gregory') {
    let cand = new Date(orig);
    while (isDateBeforeToday(cand, now)) cand = addYears(cand, n);
    return cand;
  }
  if (ev.calendar === 'chinese') {
    // 農曆另外走專用的比對邏輯，才能正確處理「閏月」與「三十撞閏月」這些一般月份比對沒有的情況
    // （見 findNextChineseMatch 開頭註解）；原本這裡直接用 parseInt(parts.month) 會把 "6bis"
    // 這種閏月數字直接讀成 6，閏月旗標整個遺失，導致閏月事件永遠被當成一般月份處理。
    const info = getChineseDateInfo(orig);
    if (!info) return orig;
    const found = findNextChineseMatch(info.month, info.day, info.isLeap, now, 400);
    if (!found) return orig;
    found.setHours(orig.getHours(), orig.getMinutes(), 0, 0);
    return found;
  }
  const parts = getCalendarParts(orig, ev.calendar);
  if (!parts) return orig;
  const found = findNextCalendarMatch(ev.calendar, parseInt(parts.month), parseInt(parts.day), now, 400);
  if (!found) return orig;
  found.setHours(orig.getHours(), orig.getMinutes(), 0, 0);
  return found;
}

export function getYearlyOccurrenceInYear(ev, targetYear) {
  // 這裡原本用固定的「某個月 1 號」（先是前一年 12 月 1 號，後來改成目標年份 1 月 1 號）
  // 當基準，兩種寫法都建立在一個錯誤假設上：以為「1 月 1 號」一定落在任何農曆月份區塊
  // 之外。事實不是這樣——農曆冬月（11 月）幾乎每年都橫跨西曆跨年那一刻（冬月本身就是以
  // 冬至為準去定位，天生就貼著年底），例如 2025 年的農曆冬月是西曆 12/20～隔年 1/18，
  // 完整跨過 1 月 1 號。如果事件的農曆生日剛好落在冬月初三（西曆 12/22），拿「目標年份
  // 1 月 1 號」當基準往未來掃描，會發現自己已經身處在冬月這個區塊「中途」（今年的初三
  // 已經在 1 月 1 號之前就過了），找不到「今天以後」還吻合的那一天，於是誤判成「這個月
  // 沒有這個日期」、退而返回區塊最後一天頂替——初三就這樣被錯改成三十（這正是使用者
  // 實測回報的「冬月初三自動變冬月三十」）。臘月（12 月）也有同樣的風險。
  // 換句話說：任何「隨便選一個月初／年初」當基準的做法，都可能剛好卡在某個事件自己的
  // 農曆月份區塊中途，這不是換一個固定基準點就能徹底避開的（因為到底哪個基準點安全，
  // 取決於「這個事件」的農曆月份幾號落在哪裡，不同事件答案不同）。
  // 真正安全的基準點只有一種：一定精準吻合過的那一天本身——也就是事件的原始日期 orig，
  // 或是「上一次已經確認精準吻合」的發生日。所以西曆固定重複維持原本「目標年份 1 月 1 號」
  // 當基準就好（addYears 逐年比較是精確的日期大小比較，不會有「区块搜尋」這種誤判可能）；
  // 農曆／伊斯蘭曆／希伯來曆等需要「往未來逐日掃描找符合區塊」的曆法，改成從 orig 本身
  // 出發，每次找到下一次吻合的日期後，用「這一次日期 + 300 天」當下一次搜尋的起點繼續找
  // ——同一個農曆月份／日期兩次之間至少間隔約 353 天，+300 天保證還沒追上下一次，但已經
  // 遠遠離開了這一次所在的區塊，起點永遠落在區塊之外，不會再有「卡在中途」的問題。
  // 為了不用真的從幾十年前的原始日期逐年搜尋到目標年份（那樣要跑太多次），先用簡單的
  // 日期加法（不呼叫任何曆法轉換，純數字運算很快）粗略跳到目標年份前兩年附近，只是抓
  // 大概位置；就算粗跳的落點剛好卡進某個區塊中途也沒關係——那一輪找到的日期只是用來
  // 算下一個安全起點（+300 天），不會被當成最終答案，迴圈會在真正落進目標年份時才停止、
  // 回傳當下那一次算出來的日期。
  const orig = combineDateTime(ev.date, ev.time);
  if (!ev.repeat) return orig;
  if (!ev.calendar || ev.calendar === 'gregory') {
    return getEffectiveDate(ev, new Date(targetYear, 0, 1));
  }
  const roughYears = targetYear - orig.getFullYear();
  let cursor = roughYears > 2 ? addDays(orig, Math.round((roughYears - 2) * 365.25)) : orig;
  let found = orig;
  for (let i = 0; i < 8; i++) {
    found = getEffectiveDate(ev, cursor);
    if (found.getFullYear() >= targetYear) break;
    cursor = addDays(found, 300);
  }
  return found;
}

export function getEventOccurrencesInRange(events, rangeStart, rangeEnd) {
  const startTime = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()).getTime();
  const endTime = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate()).getTime();
  const results = [];
  events.forEach(ev => {
    if (ev.repeat && ev.repeatUnit === 'month') {
      const monthKeys = new Set();
      let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
      const endCursor = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
      while (cursor <= endCursor) {
        monthKeys.add(`${cursor.getFullYear()}-${cursor.getMonth()}`);
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
      monthKeys.forEach(key => {
        const [y, m] = key.split('-').map(Number);
        const ref = new Date(y, m, 1);
        const occ = getEffectiveDate(ev, ref);
        if (occ.getFullYear() !== y || occ.getMonth() !== m) return;
        const occTime = new Date(occ.getFullYear(), occ.getMonth(), occ.getDate()).getTime();
        if (occTime >= startTime && occTime <= endTime) results.push({ ev, occ });
      });
    } else {
      const years = new Set();
      for (let y = rangeStart.getFullYear(); y <= rangeEnd.getFullYear(); y++) years.add(y);
      years.forEach(y => {
        const occ = getYearlyOccurrenceInYear(ev, y);
        if (occ.getFullYear() !== y) return;
        const occTime = new Date(occ.getFullYear(), occ.getMonth(), occ.getDate()).getTime();
        if (occTime >= startTime && occTime <= endTime) results.push({ ev, occ });
      });
    }
  });
  return results;
}
