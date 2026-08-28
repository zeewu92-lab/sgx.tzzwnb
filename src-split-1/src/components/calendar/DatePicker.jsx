import { useState, useEffect, useRef } from 'react';
import { ACCENT, SELECT_CLASS, SELECT_STYLE } from '../../constants/colors.js';
import { LOCALE_MAP } from '../../constants/languages.js';
import { isoDateStr } from '../../utils/date.js';
import { JP_ERAS, buildChineseYearMonths, calNumericParts, calendarDateToGregorian, chineseCalendarToGregorian, chineseDayName, chineseMonthInfo, getCalendarMonthCount, getCalendarMonthDays, getJapaneseEra, japaneseEraToGregorianYear, japaneseEraYearMax } from '../../utils/lunar.js';

export function CalendarDatePicker({ calendarId, isoDate, onChange, syncKey, lang, t }) {
  const [era, setEra] = useState('reiwa');
  const [year, setYear] = useState(null);
  const [yearText, setYearText] = useState(''); // 年份輸入框的顯示文字，與 year 分開管理，讓使用者可以把數字整個刪空後再重新輸入
  const [month, setMonth] = useState(null); // 農曆為月份名稱字串，其餘曆法為數字
  const [day, setDay] = useState(null);
  const ready = useRef(false);
  const yearDebounceRef = useRef(null); // 伊斯蘭曆／希伯來曆／農曆換算年份時需要逐日掃描比對，運算量較大，
  // 若每打一個數字就立即觸發換算會造成打字卡頓，所以改成停止輸入一小段時間後才真正換算

  useEffect(() => () => { if (yearDebounceRef.current) clearTimeout(yearDebounceRef.current); }, []);

  // year 由外部（切換曆法、切換年號、點選快速選單）變動時，同步更新輸入框顯示文字，這些地方會各自明確呼叫 setYearText；
  // 手動輸入時則完全交給輸入框自己的 onChange 管理文字，兩邊不會互相搶著更新，才不會讓打字時卡頓、跳字

  // 切換曆法或重新開啟表單時，依目前的西曆日期（或今天）反推曆法年月日，作為選單初始值
  useEffect(() => {
    ready.current = false;
    if (yearDebounceRef.current) { clearTimeout(yearDebounceRef.current); yearDebounceRef.current = null; }
    const base = isoDate ? new Date(isoDate + 'T00:00:00') : new Date();
    if (calendarId === 'chinese') {
      const info = chineseMonthInfo(base);
      if (info) { setYear(info.year); setYearText(String(info.year)); setMonth(info.month); setDay(info.day); }
    } else if (calendarId === 'japanese') {
      const p = calNumericParts(base, 'japanese');
      const e = getJapaneseEra(base);
      if (p && e) { setEra(e.id); setYear(e.year); setYearText(String(e.year)); setMonth(p.month); setDay(p.day); }
    } else {
      const p = calNumericParts(base, calendarId);
      if (p) { setYear(p.year); setYearText(String(p.year)); setMonth(p.month); setDay(p.day); }
    }
    requestAnimationFrame(() => { ready.current = true; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarId, syncKey]);

  // 年、月、日任一項變動時，換算成西曆日期回傳給上層（跳過初始化那一輪，避免多餘的更新）
  useEffect(() => {
    if (!ready.current || year == null || month == null || day == null) return;
    let g = null;
    if (calendarId === 'chinese') g = chineseCalendarToGregorian(year, month, day);
    else if (calendarId === 'japanese') g = calendarDateToGregorian('japanese', japaneseEraToGregorianYear(era, year), month, day);
    else g = calendarDateToGregorian(calendarId, year, month, day);
    if (g) onChange(isoDateStr(g));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, era, month, day]);

  if (year == null || month == null || day == null) return null;

  const isChinese = calendarId === 'chinese';
  const chineseMonths = isChinese ? buildChineseYearMonths(year) : null;
  const gYearForDays = calendarId === 'japanese' ? japaneseEraToGregorianYear(era, year) : year;
  const monthCount = calendarId === 'hebrew' ? getCalendarMonthCount('hebrew', year) : 12;
  const dayCount = isChinese
    ? ((chineseMonths.find(m => m.label === month) || {}).days || 30)
    : getCalendarMonthDays(calendarId, gYearForDays, month);
  const yearBase = isChinese ? year : (calNumericParts(new Date(), calendarId) || { year }).year;
  const yearRangeMin = calendarId === 'japanese' ? 1 : (yearBase - 100);
  const yearRangeMax = calendarId === 'japanese' ? japaneseEraYearMax(era) : (yearBase + 30);
  const yearOptionsSet = new Set();
  for (let y = yearRangeMax; y >= yearRangeMin; y--) yearOptionsSet.add(y);
  yearOptionsSet.add(year); // 確保目前的年份一定在清單中，避免使用者手動輸入超出常見範圍的年份時，選單定位不到目前的值
  const yearOptions = Array.from(yearOptionsSet).sort((a, b) => b - a);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1.5">
        {calendarId === 'japanese' && (
          <select
            value={era}
            onChange={e => {
              const nextEra = e.target.value;
              const maxY = japaneseEraYearMax(nextEra);
              const clamped = Math.min(year || 1, maxY);
              if (yearDebounceRef.current) { clearTimeout(yearDebounceRef.current); yearDebounceRef.current = null; }
              setEra(nextEra);
              setYear(clamped);
              setYearText(String(clamped));
            }}
            className={SELECT_CLASS} style={SELECT_STYLE}
          >
            {JP_ERAS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        )}
        <input
          type="number"
          inputMode="numeric"
          value={yearText}
          onChange={e => {
            const raw = e.target.value;
            setYearText(raw); // 只更新輸入框自己的顯示文字，不會被其他地方的同步邏輯覆蓋，打字/刪除不會卡頓
            if (yearDebounceRef.current) clearTimeout(yearDebounceRef.current);
            if (raw === '' || raw === '-') return; // 使用者正在清空輸入框或準備輸入負數，先不換算，避免中途被當成 NaN
            const v = parseInt(raw, 10);
            if (Number.isNaN(v)) return;
            // 日本曆的「年」是年號內的年份，範圍有限；其餘曆法的年份原則上不特別限制，讓使用者可直接手動鍵入任何年份
            const clamped = calendarId === 'japanese' ? Math.min(Math.max(v, 1), japaneseEraYearMax(era)) : v;
            // 伊斯蘭曆／希伯來曆／農曆的換算需要逐日掃描比對，延遲一小段時間再真正觸發，避免每敲一個數字就卡一下
            yearDebounceRef.current = setTimeout(() => setYear(clamped), 220);
          }}
          onBlur={() => {
            if (yearDebounceRef.current) { clearTimeout(yearDebounceRef.current); yearDebounceRef.current = null; }
            // 使用者把輸入框留空或輸入無效內容就離開時，還原成目前生效中的年份，避免留下空白欄位
            if (yearText === '' || Number.isNaN(parseInt(yearText, 10))) { setYearText(String(year)); return; }
            // 離開欄位時立即把還沒套用的數值套用，不用等延遲時間跑完
            const v = parseInt(yearText, 10);
            setYear(calendarId === 'japanese' ? Math.min(Math.max(v, 1), japaneseEraYearMax(era)) : v);
          }}
          className={SELECT_CLASS} style={SELECT_STYLE}
        />
        {/* 快速選單：跟月份／日期選單一樣是普通原生 <select>，一定會顯示出瀏覽器原生的下拉箭頭，不會有箭頭消失的問題。
            為了不要跟左邊的輸入框重複顯示同一組數字，這裡把「目前被選中的那個年份」的選項文字故意留空，
            所以收合狀態只會看到一個空白按鈕＋原生箭頭；點開清單時，其餘年份仍會正常顯示數字可以選。 */}
        <select
          value={year}
          onChange={e => {
            const v = parseInt(e.target.value, 10);
            if (Number.isNaN(v)) return;
            const clamped = calendarId === 'japanese' ? Math.min(Math.max(v, 1), japaneseEraYearMax(era)) : v;
            if (yearDebounceRef.current) { clearTimeout(yearDebounceRef.current); yearDebounceRef.current = null; }
            setYear(clamped);
            setYearText(String(clamped));
          }}
          aria-label={t.yearPickerLabel || (lang === 'en' ? 'Pick year' : '選擇年份')}
          className="flex-shrink-0 w-8 py-2 rounded-lg text-sm outline-none text-center"
          style={SELECT_STYLE}
        >
          {yearOptions.map(y => <option key={y} value={y}>{y === year ? '' : y}</option>)}
        </select>
        <select
          value={month}
          onChange={e => {
            const val = isChinese ? e.target.value : parseInt(e.target.value);
            setMonth(val);
            setDay(1);
          }}
          className={SELECT_CLASS} style={SELECT_STYLE}
        >
          {isChinese
            ? chineseMonths.map(m => <option key={m.label} value={m.label}>{m.label}</option>)
            : Array.from({ length: monthCount }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          value={day}
          onChange={e => setDay(parseInt(e.target.value))}
          className={SELECT_CLASS} style={SELECT_STYLE}
        >
          {Array.from({ length: dayCount }, (_, i) => i + 1).map(d => (
            <option key={d} value={d}>{isChinese ? chineseDayName(d) : d}</option>
          ))}
        </select>
      </div>
      {isoDate && (
        <p className="text-xs px-1" style={{ color: ACCENT }}>
          → {new Date(isoDate + 'T00:00:00').toLocaleDateString(LOCALE_MAP[lang] || 'zh-TW')}
        </p>
      )}
    </div>
  );
}
