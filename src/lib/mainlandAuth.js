// 中國大陸版登入實作——目前還沒有真正的大陸後端伺服器，這裡先留骨架。
// 每個函式的「名稱、參數、回傳值形狀」都跟 firebaseAuth.js 完全對稱，
// 之後接上自建的 Node.js／API 伺服器時，只要把下面的內容換成真正呼叫該
// 伺服器的程式碼即可，auth.js（調度層）跟 App.jsx 完全不用改。
//
// 目前呼叫任何一個函式都會丟出明確的錯誤，方便在開發階段一眼看出
// 「哪裡不小心走到了還沒實作的大陸後端」，而不是安靜地失敗。

function notImplemented(fnName) {
  throw new Error(
    `[mainlandAuth] ${fnName}() 尚未實作——大陸後端伺服器還沒建立。` +
    ` 之後接上真正的 API 後，把這個檔案裡對應的函式換成真正的呼叫即可。`
  );
}

export function watchAuthState(callback) {
  // 尚未有大陸後端可查詢登入狀態，先視為「未登入」，並回傳一個沒有作用的取消訂閱函式，
  // 讓呼叫端（App.jsx）不會因為缺少這個回傳值而出錯。
  callback(null);
  return () => {};
}

export async function signUpWithEmail(email, password) {
  notImplemented('signUpWithEmail');
}

export async function signInWithEmail(email, password) {
  notImplemented('signInWithEmail');
}

export async function signInWithGoogle() {
  notImplemented('signInWithGoogle');
}

export async function signInWithApple() {
  notImplemented('signInWithApple');
}

export async function sendMagicLink(email) {
  notImplemented('sendMagicLink');
}

export async function completeEmailLinkSignInIfNeeded() {
  // 沒有連結可處理，回傳 null 是安全的預設值（跟 firebaseAuth.js 的「沒有登入連結」情況一致）
  return null;
}

export async function signOutUser() {
  // 本來就沒有登入狀態，什麼都不用做
}

export function getCurrentUserProviderId() {
  return null;
}

export async function changePassword(currentPassword, newPassword) {
  notImplemented('changePassword');
}

export async function deleteAccount(currentPassword) {
  notImplemented('deleteAccount');
}
