// Firebase 版的雲端同步實作。
// 骨架資料（clocks/events/lang/isDark/customIcons）存在 Firestore 的 users/{uid}/data/app 文件。
// 相片實際內容存在 Firebase Storage（users/{uid}/albums/{albumId}/{photoId}.jpg），
// Firestore 這邊只留一份輕量的「索引」文件（users/{uid}/data/albumPhotos），內容只有
// { [albumId]: [photoId, ...] }，不含相片本體——因為 Storage 是設計來放檔案的，沒有
// Firestore 單一文件 1 MiB 那種「跟其他資料擠在同一份文件裡」的限制，相片數量才不會受限於
// 骨架資料能不能一起塞進 1 MiB 裡，也不用再靠「太大就放棄同步相片」這種退而求其次的做法。
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase.js';

function userDocRef(uid) {
  return doc(db, 'users', uid, 'data', 'app');
}
function userPhotoIndexRef(uid) {
  return doc(db, 'users', uid, 'data', 'albumPhotos');
}
function photoStorageRef(uid, albumId, photoId) {
  return ref(storage, `users/${uid}/albums/${albumId}/${photoId}.jpg`);
}

// 讀取雲端資料；帳號第一次登入、雲端完全還沒有資料時回傳 null。
// 骨架資料（app 文件）不存在就視為「沒有雲端資料」。相片索引文件是額外讀取：讀到索引後，
// 依索引裡記的每個相片 id 去 Storage 換一個下載網址（getDownloadURL），组回
// { [albumId]: [{id, url}, ...] } 附加到 albumPhotos 欄位上。單一相片換網址失敗（例如那個
// 檔案其實已經不在 Storage 上了）就跳過那一張，不影響其他相片、也不影響骨架資料本身讀不讀得到。
export async function loadCloudData(uid) {
  const snap = await getDoc(userDocRef(uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  try {
    const indexSnap = await getDoc(userPhotoIndexRef(uid));
    if (indexSnap.exists()) {
      const index = indexSnap.data().albums || {};
      const albumPhotos = {};
      await Promise.all(Object.keys(index).map(async albumId => {
        const ids = index[albumId] || [];
        const photos = [];
        await Promise.all(ids.map(async id => {
          try {
            const url = await getDownloadURL(photoStorageRef(uid, albumId, id));
            photos.push({ id, url });
          } catch (err) {
            // 這張相片的檔案可能已經不在 Storage 上了（例如上傳到一半失敗），跳過即可
          }
        }));
        if (photos.length) albumPhotos[albumId] = photos;
      }));
      if (Object.keys(albumPhotos).length) data.albumPhotos = albumPhotos;
    }
  } catch (err) {
    // 索引文件讀不到，當作沒有相片，不影響骨架資料
  }
  return data;
}

// 整包覆蓋寫入雲端（用在登入後決定「以雲端為主」「以本機為主」「合併」之後的最終結果，
// 也用在平常資料變動時的自動推送）。
// 骨架資料永遠整包覆蓋寫進主文件（app）。
// 相片（data.albumPhotos，如果有帶的話）則是：每張相片先上傳到 Storage（只有帶著 dataUrl 的
// 才會真的上傳——如果一張相片只有 { id, url } 沒有 dataUrl，代表它本來就是從雲端下載回來的，
// Storage 上早就有這個檔案了，不需要也不會重複上傳，省掉大部分不必要的流量）。
// 只有真的上傳成功的相片 id 才會被寫進索引——如果不管成不成功都先把 id 記進去，一旦上傳失敗
// （例如 Storage 服務根本還沒啟用），索引就會出現「查得到 id、卻連不到任何實際檔案」的假資料，
// 而且因為這裡不會拋錯，外層會誤以為「這次同步成功了」而不再重試，相片就永遠補不回來。
// 索引文件本身還是整包覆蓋、不用 merge（避免使用者刪掉相冊或相片後，舊 id 永遠留在索引裡）；
// 只要這次有任何一張相片上傳失敗，最後會拋出錯誤——外層（App.jsx 的 saveCloudDataBestEffort）
// 看到錯誤就會知道「相片這部分沒有真的同步成功」，不會誤標記、之後資料一有變動就會自動再試一次，
// 不需要使用者自己手動觸發重新上傳。
// 呼叫端如果這次的 data 沒帶 albumPhotos 欄位（例如外層 retry 時決定先不送相片），這裡就完全
// 不去動索引文件，保留它上一次成功寫入的內容。
export async function saveCloudData(uid, data) {
  const { albumPhotos, ...meta } = data;
  await setDoc(userDocRef(uid), { ...meta, updatedAt: Date.now() });
  if (albumPhotos !== undefined) {
    const index = {};
    let anyUploadFailed = false;
    await Promise.all(Object.keys(albumPhotos).map(async albumId => {
      const photos = albumPhotos[albumId] || [];
      const ids = [];
      await Promise.all(photos.map(async p => {
        if (!p || !p.id) return;
        if (!p.dataUrl) { ids.push(p.id); return; } // 只有 url：Storage 上已經有這個檔案，不用重傳
        try {
          await uploadString(photoStorageRef(uid, albumId, p.id), p.dataUrl, 'data_url');
          ids.push(p.id); // 確認真的上傳成功才寫進索引
        } catch (err) {
          anyUploadFailed = true; // 這一張失敗就跳過，不寫進索引，也不影響同相冊其他張、其他相冊
        }
      }));
      if (ids.length) index[albumId] = ids;
    }));
    await setDoc(userPhotoIndexRef(uid), { albums: index, updatedAt: Date.now() });
    if (anyUploadFailed) {
      throw new Error('[firebaseSync] 部分相片上傳到 Storage 失敗（骨架資料與已上傳成功的相片仍已存上雲端）');
    }
  }
}
