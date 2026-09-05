import {
  pushChanges,
  pullChanges,
  fullSync,
  clearSyncState
} from './sync.js';

const SETTINGS_ID =
  '00000000-0000-4000-8000-000000000001';

const CLOCKS_ID =
  '00000000-0000-4000-8000-000000000002';

const EVENTS_ID =
  '00000000-0000-4000-8000-000000000003';

const ALBUMS_ID =
  '00000000-0000-4000-8000-000000000004';

function nowIso() {
  return new Date().toISOString();
}

function createBundleRecords(data) {
  const updatedAt = nowIso();

  return [
    {
      id: SETTINGS_ID,
      operation: 'upsert',
      updatedAt,
      data: {
        type: 'settings',
        value: {
          lang: data?.lang ?? 'zh-TW',
          isDark:
            typeof data?.isDark === 'boolean'
              ? data.isDark
              : false,
          customIcons:
            Array.isArray(data?.customIcons)
              ? data.customIcons
              : []
        }
      }
    },

    {
      id: CLOCKS_ID,
      operation: 'upsert',
      updatedAt,
      data: {
        type: 'clocks',
        value:
          Array.isArray(data?.clocks)
            ? data.clocks
            : []
      }
    },

    {
      id: EVENTS_ID,
      operation: 'upsert',
      updatedAt,
      data: {
        type: 'events',
        value:
          Array.isArray(data?.events)
            ? data.events
            : []
      }
    },

    {
      id: ALBUMS_ID,
      operation: 'upsert',
      updatedAt,
      data: {
        type: 'albums',
        value:
          Array.isArray(data?.albums)
            ? data.albums
            : []
      }
    }
  ];
}

function getRecordValue(event) {
  if (
    !event ||
    typeof event !== 'object'
  ) {
    return null;
  }

  const data = event.data;

  if (
    !data ||
    typeof data !== 'object'
  ) {
    return null;
  }

  return data;
}

function applyRecord(
  result,
  event
) {
  const data =
    getRecordValue(event);

  if (!data) {
    return;
  }

  switch (data.type) {
    case 'settings': {
      const value =
        data.value;

      if (
        !value ||
        typeof value !== 'object'
      ) {
        return;
      }

      if (
        typeof value.lang === 'string'
      ) {
        result.lang =
          value.lang;
      }

      if (
        typeof value.isDark === 'boolean'
      ) {
        result.isDark =
          value.isDark;
      }

      if (
        Array.isArray(
          value.customIcons
        )
      ) {
        result.customIcons =
          value.customIcons;
      }

      break;
    }

    case 'clocks': {
      if (
        Array.isArray(data.value)
      ) {
        result.clocks =
          data.value;
      }

      break;
    }

    case 'events': {
      if (
        Array.isArray(data.value)
      ) {
        result.events =
          data.value;
      }

      break;
    }

    case 'albums': {
      if (
        Array.isArray(data.value)
      ) {
        result.albums =
          data.value;
      }

      break;
    }

    default:
      break;
  }
}

function buildEmptyResult() {
  return {
    clocks: [],
    events: [],
    lang: 'zh-TW',
    isDark: false,
    customIcons: [],
    albums: []
  };
}

function normalizeCloudEvents(events) {
  if (!Array.isArray(events)) {
    return [];
  }

  return events.filter(
    event =>
      event &&
      typeof event === 'object' &&
      !event.deletedAt
  );
}

function buildCloudData(events) {
  const result =
    buildEmptyResult();

  for (
    const event
    of normalizeCloudEvents(events)
  ) {
    applyRecord(
      result,
      event
    );
  }

  return result;
}

export async function loadCloudData(
  uid
) {
  /*
   * uid 保留在函式參數中，是為了與原本
   * cloudSync.js / firebaseSync.js 的介面保持一致。
   *
   * 自建後端真正的身份認證由 HttpOnly Session Cookie
   * 負責，API 不接受前端傳入 uid 作為身份依據。
   */

  void uid;

  /*
   * 第一次載入時使用 fullSync。
   *
   * fullSync 只負責取得目前雲端資料。
   * cursor 由後續正式同步流程維護。
   */
  const data =
    await fullSync();

  if (
    !data?.ok ||
    !Array.isArray(data.events)
  ) {
    return null;
  }

  /*
   * 雲端完全沒有資料。
   *
   * 這代表這個帳號尚未建立同步資料，
   * 必須讓 App.jsx 進入原本的「首次上傳本機資料」流程。
   */
  if (
    data.events.length === 0
  ) {
    return null;
  }

  return buildCloudData(
    data.events
  );
}

export async function saveCloudData(
  uid,
  data
) {
  void uid;

  /*
   * albumPhotos 目前不進 PostgreSQL。
   *
   * 先把相簿基本資料同步到 PostgreSQL。
   * 相片本體之後接 Object Storage。
   */
  const changes =
    createBundleRecords(data);

  const result =
    await pushChanges(
      changes
    );

  if (
    !result?.ok
  ) {
    throw new Error(
      'MAINLAND_SYNC_PUSH_FAILED'
    );
  }

  /*
   * 目前自建後端 V1 不同步相片。
   *
   * 這裡不拋錯，避免相片存在時讓整個
   * 文字／事件同步被判定為失敗。
   */
  return {
    ok: true,
    photosSynced: false
  };
}

export async function pullCloudChanges(
  uid
) {
  const result =
    await pullChanges(uid);

  if (
    !result?.ok
  ) {
    throw new Error(
      'MAINLAND_SYNC_PULL_FAILED'
    );
  }

  return {
    ok: true,
    events:
      Array.isArray(result.events)
        ? result.events
        : [],
    cursor:
      result.cursor || null
  };
}

export function clearCloudSyncState(
  uid
) {
  clearSyncState(uid);
}

export default {
  loadCloudData,
  saveCloudData,
  pullCloudChanges,
  clearCloudSyncState
};
