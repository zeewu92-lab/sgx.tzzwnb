// 中國大陸版雲端同步實作——目前還沒有真正的大陸後端伺服器，這裡先留骨架。
// 函式名稱、參數、回傳值形狀都跟 firebaseSync.js 完全對稱，之後接上自建的
// Node.js + MySQL/PostgreSQL 伺服器時，把下面內容換成真正的 API 呼叫即可，
// cloudSync.js（調度層）跟 App.jsx 完全不用改。

function notImplemented(fnName) {
  throw new Error(
    `[mainlandSync] ${fnName}() 尚未實作——大陸後端伺服器還沒建立。` +
    ` 之後接上真正的 API 後，把這個檔案裡對應的函式換成真正的呼叫即可。`
  );
}

// 讀取雲端資料；大陸後端還沒建立前一律回傳 null，
// 這會讓 App.jsx 的合併邏輯自然地退回「只用本機資料」，不會整個掛掉。
export async function loadCloudData(uid) {
  return null;
}

// 整包覆蓋寫入雲端；大陸後端還沒建立前直接丟錯，
// 呼叫端已經有 try/catch（背景同步失敗會靜默重試），使用者不會因此卡住。
export async function saveCloudData(uid, data) {
  notImplemented('saveCloudData');
}
