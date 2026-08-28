// Firebase 版的登入實作——原本 auth.js 的內容整份搬過來，邏輯完全沒動。
// 之後 auth.js 會變成「調度層」，依環境決定要用這份還是 mainlandAuth.js。
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut,
  updatePassword,
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  EmailAuthProvider,
} from 'firebase/auth';
import { auth } from './firebase.js';

const MAGIC_LINK_EMAIL_KEY = 'pending-magic-link-email';

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function signUpWithEmail(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signInWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

export async function signInWithApple() {
  const provider = new OAuthProvider('apple.com');
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

// 寄出 Email 免密碼登入連結；使用者點開信件裡的連結回到本頁後，
// 由 completeEmailLinkSignInIfNeeded() 接手完成登入。
export async function sendMagicLink(email) {
  const actionCodeSettings = {
    url: window.location.href,
    handleCodeInApp: true,
  };
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  window.localStorage.setItem(MAGIC_LINK_EMAIL_KEY, email);
}

// 在 App 啟動時呼叫一次：如果目前網址是使用者從信件點回來的登入連結，就完成登入。
export async function completeEmailLinkSignInIfNeeded() {
  if (!isSignInWithEmailLink(auth, window.location.href)) return null;
  let email = window.localStorage.getItem(MAGIC_LINK_EMAIL_KEY);
  if (!email) {
    // 使用者可能在別的裝置點開信件連結，退回來讓他手動輸入 email 確認
    email = window.prompt('請再輸入一次您的 Email 以完成登入：');
  }
  if (!email) return null;
  const cred = await signInWithEmailLink(auth, email, window.location.href);
  window.localStorage.removeItem(MAGIC_LINK_EMAIL_KEY);
  // 清掉網址上的登入連結參數，避免重整頁面時重複觸發
  window.history.replaceState({}, document.title, window.location.pathname);
  return cred.user;
}

export async function signOutUser() {
  await signOut(auth);
}

// 回傳目前登入者的登入方式（'password' | 'google.com' | 'apple.com'），未登入則回傳 null。
export function getCurrentUserProviderId() {
  const user = auth.currentUser;
  if (!user || !user.providerData || user.providerData.length === 0) return null;
  return user.providerData[0].providerId;
}

// 修改密碼、註銷帳號都屬於敏感操作，Firebase 要求「最近登入過」才能執行，
// 所以這裡先依登入方式重新驗證一次身份：Email/密碼帳號要再輸入一次密碼，
// Google／Apple 帳號則跳出一次 popup 重新授權。
async function reauthenticate(currentPassword) {
  const user = auth.currentUser;
  if (!user) throw new Error('not signed in');
  const providerId = user.providerData[0]?.providerId;
  if (providerId === 'google.com') {
    await reauthenticateWithPopup(user, new GoogleAuthProvider());
  } else if (providerId === 'apple.com') {
    await reauthenticateWithPopup(user, new OAuthProvider('apple.com'));
  } else {
    if (!currentPassword) throw new Error('missing current password');
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
  }
}

export async function changePassword(currentPassword, newPassword) {
  await reauthenticate(currentPassword);
  await updatePassword(auth.currentUser, newPassword);
}

export async function deleteAccount(currentPassword) {
  await reauthenticate(currentPassword);
  await deleteUser(auth.currentUser);
}
