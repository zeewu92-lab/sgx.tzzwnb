export function isLikelyMainlandChinaUser() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz === 'Asia/Shanghai' || tz === 'Asia/Urumqi') return true;
    const langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']);
    if (langs.some(l => (l || '').toLowerCase() === 'zh-cn')) return true;
  } catch (err) {
    // 任何環境不支援 Intl／navigator 的例外情況，一律不擋，避免誤傷正常用戶
  }
  return false;
}

export function getGreetingInfo(date, tz) {
  let hour;
  try {
    const zone = tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
    hour = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', hour12: false }).format(date), 10);
  } catch (err) {
    hour = date.getHours();
  }
  if (hour >= 5 && hour < 9) return { key: 'greetMorning', emoji: '☀️' };
  if (hour >= 9 && hour < 12) return { key: 'greetForenoon', emoji: '🌤️' };
  if (hour >= 12 && hour < 14) return { key: 'greetAfternoon', emoji: '🌤️' };
  if (hour >= 14 && hour < 18) return { key: 'greetLateAfternoon', emoji: '🌇' };
  return { key: 'greetEvening', emoji: '🌙' };
}

export function getUtcOffset(tz, now) {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' });
    const part = dtf.formatToParts(now).find(p => p.type === 'timeZoneName');
    if (!part) return '';
    return part.value.replace('GMT', 'UTC').replace(/UTC$/, 'UTC+00:00');
  } catch (e) { return ''; }
}

export function getOffsetMinutes(tz, now) {
  const offsetStr = getUtcOffset(tz, now);
  const m = offsetStr.match(/UTC([+-])(\d{2}):(\d{2})/);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}

export function formatOffsetDiff(diffMinutes) {
  const sign = diffMinutes > 0 ? '+' : '−';
  const abs = Math.abs(diffMinutes);
  const h = Math.floor(abs / 60);
  const mm = abs % 60;
  return `${sign}${h}${mm ? `:${String(mm).padStart(2, '0')}` : ''}`;
}

export function getTimeHMS(date, tz) {
  try {
    const zone = tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false,
    }).formatToParts(date);
    const obj = {};
    parts.forEach(p => { if (p.type !== 'literal') obj[p.type] = parseInt(p.value, 10); });
    return { h: obj.hour % 24, m: obj.minute, s: obj.second, ms: date.getMilliseconds() };
  } catch (err) {
    return { h: date.getHours(), m: date.getMinutes(), s: date.getSeconds(), ms: date.getMilliseconds() };
  }
}

// 取得某個時區「現在」對應的當地日期（年/月/日），日出日落計算要用「當地那一天」
// 而不是使用者瀏覽器所在地的日期，兩者在日期交界前後可能差一天。
export function getLocalDateParts(date, tz) {
  try {
    const zone = tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, year: 'numeric', month: 'numeric', day: 'numeric',
    }).formatToParts(date);
    const obj = {};
    parts.forEach(p => { if (p.type !== 'literal') obj[p.type] = parseInt(p.value, 10); });
    return { y: obj.year, m: obj.month, d: obj.day };
  } catch (err) {
    return { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() };
  }
}

// 日出／日落時間計算（NOAA／《天文年鑑》通用簡化公式，又稱 Sunrise Equation）。
// 傳入某個時區「當地那一天」＋座標，回傳當天日出/日落的 UTC 時刻（Date）；
// 極晝/極夜等算不出日出或日落的情況回傳 null。精度落在幾分鐘之內，
// 給「城市詳細頁」參考已經足夠，不是導航等級的精確計算。
export function getSunTimes(date, tz, lat, lng) {
  const { y, m, d } = getLocalDateParts(date, tz);
  const rad = Math.PI / 180;
  const dayStartUTC = Date.UTC(y, m - 1, d);
  const dayOfYear = Math.floor((dayStartUTC - Date.UTC(y, 0, 1)) / 86400000) + 1;
  const lngHour = lng / 15;

  function calc(isSunrise) {
    const t = dayOfYear + ((isSunrise ? 6 : 18) - lngHour) / 24;
    const M = 0.9856 * t - 3.289;
    let L = M + 1.916 * Math.sin(M * rad) + 0.020 * Math.sin(2 * M * rad) + 282.634;
    L = ((L % 360) + 360) % 360;
    let RA = Math.atan(0.91764 * Math.tan(L * rad)) / rad;
    RA = ((RA % 360) + 360) % 360;
    const Lquadrant = Math.floor(L / 90) * 90;
    const RAquadrant = Math.floor(RA / 90) * 90;
    RA = (RA + (Lquadrant - RAquadrant)) / 15;
    const sinDec = 0.39782 * Math.sin(L * rad);
    const cosDec = Math.cos(Math.asin(sinDec));
    const zenith = 90.833;
    const cosH = (Math.cos(zenith * rad) - sinDec * Math.sin(lat * rad)) / (cosDec * Math.cos(lat * rad));
    if (cosH > 1 || cosH < -1) return null; // 極夜（升不起來）／極晝（不會落下）
    let H = isSunrise ? 360 - Math.acos(cosH) / rad : Math.acos(cosH) / rad;
    H = H / 15;
    const T = H + RA - 0.06571 * t - 6.622;
    let UT = ((T - lngHour) % 24 + 24) % 24;
    const hour = Math.floor(UT);
    const minute = Math.round((UT - hour) * 60);
    return new Date(Date.UTC(y, m - 1, d, hour, minute));
  }

  return { sunrise: calc(true), sunset: calc(false) };
}

export function formatSunTime(sunDate, tz, lang, localeMap) {
  if (!sunDate) return '—';
  return new Intl.DateTimeFormat(localeMap[lang], { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(sunDate);
}
