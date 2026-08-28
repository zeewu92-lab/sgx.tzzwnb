// Firebase 初始化——這裡的 config 值不是密碼，是公開的前端設定值，可以放心留在程式碼裡。
// 專案：dailyzzw'mainlandcn（Firebase Console 裡看到的名稱）
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyDsZR5Vq0-GhN_WfUyaqJf0SjqJJSfWqnU',
  authDomain: 'dailyzzw-mainlandcn.firebaseapp.com',
  projectId: 'dailyzzw-mainlandcn',
  storageBucket: 'dailyzzw-mainlandcn.firebasestorage.app',
  messagingSenderId: '504033790993',
  appId: '1:504033790993:web:2037c6d5d8db08e44175b0',
  measurementId: 'G-MSXHGTD5QT',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
// ignoreUndefinedProperties：本機物件若不小心帶有 undefined 欄位，寫入 Firestore 時原本會直接丟出例外，
// 而外層 saveCloudData 的呼叫端多半用 .catch(() => {}) 靜默吞掉錯誤，等於雲端資料整包沒寫成功、
// 卻完全沒有任何提示。這會讓雲端資料永遠停留在舊版本，跟本機資料對不起來，導致每次重新打開 App
// 都被判定為「本機和雲端不一樣」而跳出合併提示。開啟這個選項後，undefined 欄位會被自動忽略、不再讓整次寫入失敗。
export const db = initializeFirestore(firebaseApp, { ignoreUndefinedProperties: true });
// Storage：相片實際的檔案內容改存在這裡，不再塞進 Firestore 文件。Firestore 單一文件有 1 MiB
// 的硬上限，相片幾張一多很容易超過；Storage 是設計來放檔案的，沒有這種「跟其他資料擠在同一份
// 文件裡」的問題，相片數量才不會受限於事件、時鐘這些骨架資料能不能一起塞進 1 MiB 裡。
export const storage = getStorage(firebaseApp);

