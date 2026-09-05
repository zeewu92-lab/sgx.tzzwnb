// 時光線自建帳戶後端登入實作。
// 透過 VITE_API_BASE_URL 連接自建 Node.js API。
// 對外介面保持與 firebaseAuth.js 一致，
// 因此 auth.js、App.jsx、Account.jsx 不需要因為後端切換而修改。

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000';

const USER_CACHE_KEY = 'timezzw_account_user';

let currentUser = null;
const authListeners = new Set();

function notifyAuthState() {
  for (const callback of authListeners) {
    try {
      callback(currentUser);
    } catch (error) {
      console.error('[mainlandAuth] auth state callback error:', error);
    }
  }
}

function saveCachedUser(user) {
  try {
    if (user) {
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_CACHE_KEY);
    }
  } catch (error) {
    console.warn('[mainlandAuth] 無法寫入本機帳戶快取：', error);
  }
}

function readCachedUser() {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;

    const user = JSON.parse(raw);

    if (!user || !user.id || !user.email) {
      localStorage.removeItem(USER_CACHE_KEY);
      return null;
    }

    return user;
  } catch (error) {
    localStorage.removeItem(USER_CACHE_KEY);
    return null;
  }
}

function normalizeUser(user) {
  if (!user) return null;

  const id = user.id ?? user.uid ?? null;

  if (!id) return null;

  const nickname = user.nickname ?? user.displayName ?? null;
  const avatar = user.avatar ?? user.photoURL ?? null;

  return {
    uid: id,
    id,
    email: user.email ?? null,

    // Firebase 相容欄位
    displayName: nickname,
    nickname,

    photoURL: avatar,
    avatar,

    status: user.status ?? 'active',

    providerData: [
      {
        providerId: 'password'
      }
    ],

    createdAt: user.createdAt ?? null
  };
}

async function apiRequest(path, options = {}) {
  console.log('[mainlandAuth] API request:', {
    url: `${API_BASE_URL}${path}`,
    method: options.method || 'GET'
  });

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(
      data?.error || `HTTP_${response.status}`
    );

    error.code = data?.error || `HTTP_${response.status}`;
    error.status = response.status;

    throw error;
  }

  return data;
}

function setCurrentUser(user, shouldNotify = true) {
  currentUser = normalizeUser(user);
  saveCachedUser(currentUser);

  if (shouldNotify) {
    notifyAuthState();
  }

  return currentUser;
}

async function refreshCurrentUser() {
  try {
    const data = await apiRequest('/api/auth/me');

    if (!data?.ok || !data.user) {
      setCurrentUser(null);
      return null;
    }

    return setCurrentUser(data.user);
  } catch (error) {
    // 401 代表 Session 不存在或已失效。
    // 其他錯誤則保留本機快取，避免 API 暫時無法連線時
    // 把使用者突然當成登出狀態。
    if (
      error?.status === 401 ||
      error?.code === 'NOT_AUTHENTICATED' ||
      error?.code === 'SESSION_INVALID' ||
      error?.code === 'ACCOUNT_UNAVAILABLE'
    ) {
      setCurrentUser(null);
      return null;
    }

    console.warn('[mainlandAuth] /api/auth/me 失敗：', error);

    return currentUser;
  }
}

export function watchAuthState(callback) {
  authListeners.add(callback);

  // 先立即提供目前狀態。
  // 若瀏覽器重新整理，這可以讓 App 優先恢復本機快取的帳戶資訊。
  const cachedUser = readCachedUser();

  if (cachedUser) {
    currentUser = normalizeUser(cachedUser);
    callback(currentUser);
  } else {
    callback(null);
  }

  // 再向後端確認 HttpOnly Session Cookie。
  // 不論快取是否存在，都以伺服器 Session 為最終依據。
  refreshCurrentUser();

  return () => {
    authListeners.delete(callback);
  };
}

export async function signUpWithEmail(email, password) {
  const data = await apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password
    })
  });

  if (!data?.ok || !data.user) {
    throw new Error(data?.error || 'REGISTER_FAILED');
  }

  // Firebase 的 createUserWithEmailAndPassword()
  // 註冊成功後會直接進入登入狀態。
  // 為了保持 Account.jsx 原本的行為，
  // 自建後端註冊成功後立即執行登入。
  return signInWithEmail(email, password);
}

export async function signInWithEmail(email, password) {
  const deviceName =
    typeof navigator !== 'undefined'
      ? navigator.userAgent.slice(0, 100)
      : 'Web';

  const data = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      deviceName
    })
  });

  if (!data?.ok || !data.user) {
    throw new Error(data?.error || 'LOGIN_FAILED');
  }

  return setCurrentUser(data.user);
}

export async function signInWithGoogle() {
  throw new Error(
    '[mainlandAuth] Google 登入尚未實作。'
  );
}

export async function signInWithApple() {
  throw new Error(
    '[mainlandAuth] Apple 登入尚未實作。'
  );
}

export async function sendMagicLink(email) {
  throw new Error(
    '[mainlandAuth] Email 免密碼登入尚未實作。'
  );
}

export async function completeEmailLinkSignInIfNeeded() {
  return null;
}

export async function signOutUser() {
  try {
    await apiRequest('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({})
    });
  } finally {
    setCurrentUser(null);
  }
}

export function getCurrentUserProviderId() {
  if (!currentUser) return null;
  return 'password';
}

export async function changePassword(currentPassword, newPassword) {
  const data = await apiRequest('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({
      currentPassword,
      newPassword
    })
  });

  if (!data?.ok) {
    const error = new Error(
      data?.error || 'PASSWORD_CHANGE_FAILED'
    );

    error.code = data?.error || 'PASSWORD_CHANGE_FAILED';
    error.status = 400;

    throw error;
  }

  await refreshCurrentUser();

  return true;
}

export async function deleteAccount(currentPassword) {
  const data = await apiRequest('/api/auth/me', {
    method: 'DELETE',
    body: JSON.stringify({
      currentPassword
    })
  });

  if (!data?.ok) {
    const error = new Error(
      data?.error || 'ACCOUNT_DELETE_FAILED'
    );

    error.code = data?.error || 'ACCOUNT_DELETE_FAILED';
    error.status = 400;

    throw error;
  }

  setCurrentUser(null);

  return true;
}

export async function updateUserProfile({ nickname, avatar } = {}) {
  const data = await apiRequest('/api/auth/me', {
    method: 'PATCH',
    body: JSON.stringify({
      nickname,
      avatar
    })
  });

  if (!data?.ok || !data.user) {
    throw new Error(data?.error || 'PROFILE_UPDATE_FAILED');
  }

  return setCurrentUser(data.user);
}
