// 調度層——App.jsx 只認識這個檔案，完全不知道底下實際是 Firebase 還是大陸後端。
// 對外的函式名稱、參數、回傳值都跟原本的 auth.js 一模一樣，
// 所以這個檔案取代原本的 auth.js 之後，App.jsx 不需要改任何一行 import 或呼叫。
import * as firebaseBackend from './firebaseAuth.js';
import * as mainlandBackend from './mainlandAuth.js';
import { getBackendMode } from './backendEnv.js';

function pick() {
  return getBackendMode() === 'mainland' ? mainlandBackend : firebaseBackend;
}

export function watchAuthState(callback) {
  return pick().watchAuthState(callback);
}

export async function signUpWithEmail(email, password) {
  return pick().signUpWithEmail(email, password);
}

export async function signInWithEmail(email, password) {
  return pick().signInWithEmail(email, password);
}

export async function signInWithGoogle() {
  return pick().signInWithGoogle();
}

export async function signInWithApple() {
  return pick().signInWithApple();
}

export async function sendMagicLink(email) {
  return pick().sendMagicLink(email);
}

export async function completeEmailLinkSignInIfNeeded() {
  return pick().completeEmailLinkSignInIfNeeded();
}

export async function signOutUser() {
  return pick().signOutUser();
}

export function getCurrentUserProviderId() {
  return pick().getCurrentUserProviderId();
}

export async function changePassword(currentPassword, newPassword) {
  return pick().changePassword(currentPassword, newPassword);
}

export async function deleteAccount(currentPassword) {
  return pick().deleteAccount(currentPassword);
}

export async function updateUserProfile(profile) {
  return pick().updateUserProfile(profile);
}
