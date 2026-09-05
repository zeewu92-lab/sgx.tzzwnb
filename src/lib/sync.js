import { getBackendMode } from './backendEnv.js';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000';

const SYNC_CURSOR_PREFIX = 'timezzw_sync_cursor';

function isMainlandBackend() {
  return getBackendMode() === 'mainland';
}

function getCursorKey(uid = '') {
  const safeUid =
    typeof uid === 'string'
      ? uid.trim()
      : '';

  if (safeUid) {
    return `${SYNC_CURSOR_PREFIX}:${safeUid}`;
  }

  return SYNC_CURSOR_PREFIX;
}

function getCursor(uid = '') {
  try {
    const value = localStorage.getItem(
      getCursorKey(uid)
    );

    if (!value) {
      return 0;
    }

    const cursor = Number(value);

    if (
      !Number.isSafeInteger(cursor) ||
      cursor < 0
    ) {
      return 0;
    }

    return cursor;
  } catch {
    return 0;
  }
}

function setCursor(cursor, uid = '') {
  const value = Number(cursor);

  if (
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    return;
  }

  try {
    localStorage.setItem(
      getCursorKey(uid),
      String(value)
    );
  } catch {
    // localStorage 不可用時不阻斷同步
  }
}

function clearCursor(uid = '') {
  try {
    localStorage.removeItem(
      getCursorKey(uid)
    );
  } catch {
    // localStorage 不可用時不阻斷同步
  }
}

async function apiRequest(path, options = {}) {
  if (!isMainlandBackend()) {
    throw new Error('SYNC_BACKEND_UNAVAILABLE');
  }

  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    }
  );

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(
      data?.error ||
      `HTTP_${response.status}`
    );

    error.code =
      data?.error ||
      `HTTP_${response.status}`;

    error.status =
      response.status;

    throw error;
  }

  return data;
}

function normalizeChange(change) {
  if (
    !change ||
    typeof change !== 'object'
  ) {
    throw new Error(
      'INVALID_SYNC_CHANGE'
    );
  }

  const id =
    typeof change.id === 'string'
      ? change.id.trim()
      : '';

  if (!id) {
    throw new Error(
      'SYNC_EVENT_ID_REQUIRED'
    );
  }

  if (
    change.operation !== 'upsert' &&
    change.operation !== 'delete'
  ) {
    throw new Error(
      'SYNC_OPERATION_INVALID'
    );
  }

  const updatedAt =
    typeof change.updatedAt === 'string'
      ? change.updatedAt
      : new Date().toISOString();

  if (
    Number.isNaN(
      new Date(updatedAt).getTime()
    )
  ) {
    throw new Error(
      'SYNC_UPDATED_AT_INVALID'
    );
  }

  if (
    change.operation === 'delete'
  ) {
    return {
      id,
      operation: 'delete',
      updatedAt
    };
  }

  return {
    id,
    operation: 'upsert',
    updatedAt,
    data:
      change.data &&
      typeof change.data === 'object' &&
      !Array.isArray(change.data)
        ? change.data
        : {}
  };
}

export async function pushChanges(
  changes = []
) {
  if (!Array.isArray(changes)) {
    throw new Error(
      'SYNC_CHANGES_MUST_BE_ARRAY'
    );
  }

  if (changes.length === 0) {
    return {
      ok: true,
      results: []
    };
  }

  if (changes.length > 500) {
    throw new Error(
      'SYNC_TOO_MANY_CHANGES'
    );
  }

  const normalizedChanges =
    changes.map(normalizeChange);

  return apiRequest(
    '/api/sync/push',
    {
      method: 'POST',
      body: JSON.stringify({
        changes:
          normalizedChanges
      })
    }
  );
}

export async function pullChanges(
  uid = ''
) {
  const since = getCursor(uid);

  const data = await apiRequest(
    `/api/sync/pull?since=${encodeURIComponent(since)}`
  );

  if (!data?.ok) {
    throw new Error(
      data?.error ||
      'SYNC_PULL_FAILED'
    );
  }

  const nextCursor =
    Number(data?.cursor?.next);

  if (
    Number.isSafeInteger(nextCursor) &&
    nextCursor >= since
  ) {
    setCursor(
      nextCursor,
      uid
    );
  }

  return {
    ok: true,

    events:
      Array.isArray(data.events)
        ? data.events
        : [],

    cursor: {
      since,

      next:
        Number.isSafeInteger(
          nextCursor
        ) &&
        nextCursor >= since
          ? nextCursor
          : since
    }
  };
}

export async function fullSync() {
  const data =
    await apiRequest(
      '/api/sync/full'
    );

  if (!data?.ok) {
    throw new Error(
      data?.error ||
      'SYNC_FULL_FAILED'
    );
  }

  return {
    ok: true,

    events:
      Array.isArray(data.events)
        ? data.events
        : []
  };
}

export function getSyncCursor(
  uid = ''
) {
  return getCursor(uid);
}

export function setSyncCursor(
  cursor,
  uid = ''
) {
  setCursor(
    cursor,
    uid
  );
}

export function clearSyncState(
  uid = ''
) {
  clearCursor(uid);
}

export default {
  pushChanges,
  pullChanges,
  fullSync,
  getSyncCursor,
  setSyncCursor,
  clearSyncState
};
