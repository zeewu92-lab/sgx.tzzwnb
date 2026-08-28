// 調度層——App.jsx 只認識這個檔案，完全不知道底下實際是 Firebase 還是大陸後端。
// 對外的函式名稱、參數、回傳值都跟原本的 cloudSync.js 一模一樣，
// 所以這個檔案取代原本的 cloudSync.js 之後，App.jsx 不需要改任何一行 import 或呼叫。
import * as firebaseBackend from './firebaseSync.js';
import * as mainlandBackend from './mainlandSync.js';
import { getBackendMode } from './backendEnv.js';

function pick() {
  return getBackendMode() === 'mainland' ? mainlandBackend : firebaseBackend;
}

export async function loadCloudData(uid) {
  return pick().loadCloudData(uid);
}

export async function saveCloudData(uid, data) {
  return pick().saveCloudData(uid, data);
}
