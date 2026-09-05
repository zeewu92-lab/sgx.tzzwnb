// 集中管理「該用哪一套後端」的判斷。
// 這是整個 Firebase / Mainland 雙後端架構裡唯一需要之後手動調整的地方。

// ▼ 這段偵測邏輯跟 App.jsx 裡原本的 isLikelyMainlandChinaUser() 完全一致，
//   只是搬來這裡集中管理。App.jsx 目前仍保有自己那一份、用在登入頁的提示文字上，
//   兩邊功能不同（一個是「決定接哪個後端」，一個是「決定要不要顯示擋用戁息」），
//   之後要合併成同一份也可以，但不是必要的一步，先保持獨立、互不影響。
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

// ★ 目前唯一的開關 ★
// 'firebase'  → 一律使用 Firebase（現況，App 可以正常運作）
// 'mainland'  → 一律使用大陸後端（目前 mainlandAuth.js / mainlandSync.js 都還是空殼，
//               開了也會全部丟「尚未實作」的錯誤，不要在大陸後端真正建好之前打開）
// 'auto'      → 依 isLikelyMainlandChinaUser() 自動判斷（等大陸後端做好、要正式上線
//               雙後端並存時，把這裡改成 'auto' 即可，不用再改其他任何檔案）
const BACKEND_MODE = 'mainland';

export function getBackendMode() {
  if (BACKEND_MODE === 'auto') {
    return isLikelyMainlandChinaUser() ? 'mainland' : 'firebase';
  }
  return BACKEND_MODE;
}
