export function isLikelyMainlandChinaUser() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';

    if (tz === 'Asia/Shanghai' || tz === 'Asia/Urumqi') {
      return true;
    }

    const langs =
      navigator.languages && navigator.languages.length
        ? navigator.languages
        : [navigator.language || ''];

    if (
      langs.some(
        l => (l || '').toLowerCase() === 'zh-cn'
      )
    ) {
      return true;
    }
  } catch (err) {
    // 不支援 Intl 或 navigator 時不阻擋使用者
  }

  return false;
}
