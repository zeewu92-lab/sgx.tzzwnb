// 本地 Vite 项目里没有 Claude Artifacts 的 window.storage 后端，
// 这里用 localStorage 模拟同样的接口（get/set/delete/list），
// 让从 Artifact 移植过来的组件代码完全不用改。
//
// 注意：这里的 "shared" 参数在本地版本里没有实际意义（没有多用户），
// 只是为了保持接口签名一致，内部用不同前缀隔离一下。

const PREFIX = 'app-storage';

function storageKey(key, shared) {
  return `${PREFIX}:${shared ? 'shared' : 'private'}:${key}`;
}

function validateKey(key) {
  if (typeof key !== 'string' || key.length === 0 || key.length > 200) {
    throw new Error('Invalid storage key');
  }
  if (/[\s\/\\'"]/.test(key)) {
    throw new Error('Storage key cannot contain whitespace, slashes, or quotes');
  }
}

async function get(key, shared = false) {
  validateKey(key);
  const raw = localStorage.getItem(storageKey(key, shared));
  if (raw === null) return null;
  return { key, value: raw, shared };
}

async function set(key, value, shared = false) {
  validateKey(key);
  const strValue = typeof value === 'string' ? value : String(value);
  localStorage.setItem(storageKey(key, shared), strValue);
  return { key, value: strValue, shared };
}

async function del(key, shared = false) {
  validateKey(key);
  const existed = localStorage.getItem(storageKey(key, shared)) !== null;
  localStorage.removeItem(storageKey(key, shared));
  return { key, deleted: existed, shared };
}

async function list(prefix = '', shared = false) {
  const fullPrefix = storageKey(prefix, shared);
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(fullPrefix)) {
      keys.push(k.slice(storageKey('', shared).length));
    }
  }
  return { keys, prefix, shared };
}

if (typeof window !== 'undefined' && !window.storage) {
  window.storage = { get, set, delete: del, list };
}

export default { get, set, delete: del, list };
