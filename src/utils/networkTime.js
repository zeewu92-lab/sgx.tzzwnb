// 網路校時：修正裝置本身系統時鐘可能設錯的誤差，讓世界時鐘顯示的時間更準確。
//
// 瀏覽器沒有辦法直接讀到 NTP／原子鐘時間，只能間接做：跟一個有提供標準時間的服務要一次「現在
// 的時間」，量出「服務端說的時間」跟「我們這邊當下的系統時間」差多少（offset），之後畫面上顯示
// 的時間都用「系統時間 + offset」，而不是單純讀系統時間。網路來回本身有幾十～幾百毫秒的不確定性，
// 這裡用「假設請求來回延遲對稱、取來回時間中點對應服務端回報的那個時刻」的方式去打折來回誤差，
// 抓不到精確到毫秒等級的原子鐘準度，但足以大幅修正「使用者手機時間直接設錯」這類明顯偏差。
//
// 找不到任何一個來源可用時（離線、逾時、CORS 被擋…等），offset 維持在目前的值（第一次同步成功前
// 就是 0），等於直接退回顯示系統時間，不會讓時鐘整個顯示不出來或卡住。

const TIME_SOURCES = [
  {
    // timeapi.io：主要來源，回應包含年月日時分秒等欄位，直接組成 UTC 時間字串解析
    url: 'https://timeapi.io/api/Time/current/zone?timeZone=Etc/UTC',
    parse: (data) => {
      if (!data || typeof data.year !== 'number') return null;
      return Date.UTC(data.year, data.month - 1, data.day, data.hour, data.minute, data.seconds || 0, data.milliSeconds || 0);
    },
  },
  {
    // worldtimeapi.org：備用來源，回應的 utc_datetime 本身就是帶時區資訊的 ISO 字串
    url: 'https://worldtimeapi.org/api/timezone/Etc/UTC',
    parse: (data) => {
      if (!data || !data.utc_datetime) return null;
      const ms = Date.parse(data.utc_datetime);
      return Number.isNaN(ms) ? null : ms;
    },
  },
];

let offsetMs = 0;
let lastSyncAt = 0; // 上次成功同步的時間點（系統時間，ms），0＝從未成功同步過
let syncPromise = null;

// 目前經過網路校正後的「現在」，同步失敗過（或還沒同步過）就等於系統時間
export function getNetworkNow() {
  return new Date(Date.now() + offsetMs);
}

export function getTimeOffsetMs() { return offsetMs; }
export function getLastSyncAt() { return lastSyncAt; }

// 對外呼叫的校時函式：同一時間只會真的送出一次網路請求（重複呼叫會共用同一個進行中的 promise），
// 避免短時間內被重複觸發（例如好幾個畫面都掛載時）就打好幾次校時請求。
export async function syncNetworkTime() {
  // 短時間內（1 分鐘內）已經同步過就不重打——世界時鐘在大螢幕分欄版面可能同時掛載兩份，
  // 各自的 5 分鐘排程時間點沒對齊時，這裡可以避免兩邊各打一次幾乎沒有意義的重複請求。
  if (lastSyncAt && Date.now() - lastSyncAt < 60 * 1000) return true;
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    for (const source of TIME_SOURCES) {
      try {
        const t0 = performance.now();
        const res = await fetch(source.url, { cache: 'no-store' });
        const t1 = performance.now();
        if (!res.ok) continue;
        const data = await res.json();
        const serverMs = source.parse(data);
        if (!serverMs || Number.isNaN(serverMs)) continue;
        const roundTrip = t1 - t0;
        // 假設請求來回延遲對稱，服務端回報的那個時刻大約對應「來回中點」，
        // 用這個折半來回時間去逼近單程延遲，減少網路延遲造成的誤差
        const localAtServerMoment = Date.now() - roundTrip / 2;
        offsetMs = serverMs - localAtServerMoment;
        lastSyncAt = Date.now();
        return true;
      } catch (err) {
        continue; // 這個來源失敗（離線／逾時／CORS 被擋…等），換下一個來源試
      }
    }
    return false; // 所有來源都失敗，offset 維持原狀（未同步過就是 0，等同系統時間）
  })();
  const result = await syncPromise;
  syncPromise = null;
  return result;
}
