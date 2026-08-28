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
