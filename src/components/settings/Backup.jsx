import { useState, useEffect, useRef } from 'react';
import { saveCloudData } from '../../lib/cloudSync.js';
import { collectAllAlbumPhotos, resolveAlbumsField } from '../album/Album.jsx';
import { ACCENT, CARD_BORDER, DANGER, INK, INK_SOFT, MINT, glass } from '../../constants/colors.js';

export const BACKUP_FILE_MAGIC = 'TZZWNB1:'; // 檔案內容前綴，用來分辨「新版加密格式」跟「舊版明文 JSON」

export const BACKUP_KEY_MATERIAL = 'timezhaoziwu-backup-v1-8f3c1a9e'; // 固定金鑰來源字串，之後要換金鑰只需改這裡

export let backupCryptoKeyPromise = null;

export function getBackupCryptoKey() {
  if (!backupCryptoKeyPromise) {
    backupCryptoKeyPromise = (async () => {
      const rawKey = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(BACKUP_KEY_MATERIAL));
      return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    })();
  }
  return backupCryptoKeyPromise;
}

export function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function encryptBackupText(jsonText) {
  const key = await getBackupCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(jsonText));
  const combined = new Uint8Array(iv.length + cipherBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuf), iv.length);
  return BACKUP_FILE_MAGIC + bytesToBase64(combined);
}

export async function decryptBackupText(fileText) {
  const combined = base64ToBytes(fileText.slice(BACKUP_FILE_MAGIC.length));
  const iv = combined.slice(0, 12);
  const cipherBytes = combined.slice(12);
  const key = await getBackupCryptoKey();
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBytes);
  return new TextDecoder().decode(plainBuf);
}

export async function parseBackupPayload(fileText) {
  try {
    if (typeof fileText !== 'string' || !fileText.startsWith(BACKUP_FILE_MAGIC)) return null;
    const jsonText = await decryptBackupText(fileText);
    const data = JSON.parse(jsonText);
    if (!data || typeof data !== 'object' || (!Array.isArray(data.clocks) && !Array.isArray(data.events))) {
      return null;
    }
    return data;
  } catch (err) {
    return null;
  }
}

export function stableStringify(value) {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

export function BackupSection({ t, handleExportBackup, importFileRef, handleImportFileChange, backupMsg }) {
  return (
    <div className="flex flex-col gap-2 pt-3 mt-1" style={{ borderTop: CARD_BORDER }}>
      <p className="text-xs font-bold" style={{ color: INK_SOFT }}>{t.backupSectionTitle}</p>
      <p className="text-xs" style={{ color: INK_SOFT }}>{t.backupHint}</p>
      <p className="text-xs" style={{ color: INK_SOFT }}>{t.backupSlowdownHint}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleExportBackup}
          className="flex-1 py-2 rounded-xl text-sm font-bold"
          style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }}
        >
          {t.backupExportBtn}
        </button>
        <button
          type="button"
          onClick={() => importFileRef.current && importFileRef.current.click()}
          className="flex-1 py-2 rounded-xl text-sm font-bold"
          style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }}
        >
          {t.backupImportBtn}
        </button>
        <input
          ref={importFileRef}
          type="file"
          accept=".tzzwnb"
          className="hidden"
          onChange={handleImportFileChange}
        />
      </div>

      {backupMsg && (
        <p className="text-xs font-bold" style={{ color: backupMsg.type === 'success' ? MINT : DANGER }}>
          {backupMsg.text}
        </p>
      )}
    </div>
  );
}

export async function saveCloudDataBestEffort(uid, fullData) {
  try {
    await saveCloudData(uid, fullData);
    return { ok: true, photosSynced: fullData.albumPhotos !== undefined };
  } catch (err) {
    console.error(err);
    if (!fullData.albumPhotos) return { ok: false, photosSynced: false };
    try {
      const { albumPhotos, ...meta } = fullData;
      await saveCloudData(uid, meta);
      return { ok: true, photosSynced: false };
    } catch (err2) {
      console.error(err2);
      return { ok: false, photosSynced: false };
    }
  }
}

export function BackupDataPage({ t, backupData, onImportBackup }) {
  const importFileRef = useRef(null);
  const [backupMsg, setBackupMsg] = useState(null);

  async function buildBackupPayloadWithPhotos() {
    const albumPhotos = await collectAllAlbumPhotos(backupData.albums && backupData.albums.length ? backupData.albums : resolveAlbumsField(backupData));
    return { ...backupData, ...(Object.keys(albumPhotos).length ? { albumPhotos } : {}), exportedAt: Date.now() };
  }

  async function parseAndImport(fileText) {
    const data = await parseBackupPayload(fileText);
    if (!data) { setBackupMsg({ type: 'error', text: t.backupImportError }); return false; }
    onImportBackup(data);
    setBackupMsg({ type: 'success', text: t.backupImportSuccess });
    return true;
  }

  async function handleExportBackup() {
    const json = JSON.stringify(await buildBackupPayloadWithPhotos(), null, 2);
    const encryptedText = await encryptBackupText(json);
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    const filename = `sgx-backup-${stamp}.tzzwnb`;
    const file = new File([encryptedText], filename, { type: 'application/octet-stream' });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        setBackupMsg({ type: 'success', text: t.backupExportSuccess });
        return;
      } catch (err) { /* 使用者取消分享，退回下載方式 */ }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    setBackupMsg({ type: 'success', text: t.backupExportSuccess });
  }

  function handleImportFileChange(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => parseAndImport(String(reader.result));
    reader.onerror = () => setBackupMsg({ type: 'error', text: t.backupImportError });
    reader.readAsText(file);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: INK_SOFT }}>{t.backupHint}</p>
      <p className="text-xs leading-relaxed" style={{ color: INK_SOFT }}>{t.backupSlowdownHint}</p>
      <div className="flex gap-2">
        <button type="button" onClick={handleExportBackup} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ ...glass(), color: INK }}>
          {t.backupExportBtn}
        </button>
        <button type="button" onClick={() => importFileRef.current && importFileRef.current.click()} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ ...glass(), color: INK }}>
          {t.backupImportBtn}
        </button>
        <input ref={importFileRef} type="file" accept=".tzzwnb" className="hidden" onChange={handleImportFileChange} />
      </div>
      {backupMsg && <p className="text-xs font-bold" style={{ color: backupMsg.type === 'success' ? MINT : DANGER }}>{backupMsg.text}</p>}
    </div>
  );
}

export function formatRelativeSync(ts, t) {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return t.lastSyncedJustNow;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t.lastSyncedAgo(t.syncMinutesAgo(diffMin));
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return t.lastSyncedAgo(t.syncHoursAgo(diffHr));
  const diffDay = Math.floor(diffHr / 24);
  return t.lastSyncedAgo(t.syncDaysAgo(diffDay));
}

export function SyncDataPage({ t, fbUser, syncStatus, lastSyncedAt, onOpenAuth }) {
  const [, forceTick] = useState(0);
  useEffect(() => { const iv = setInterval(() => forceTick(v => v + 1), 30000); return () => clearInterval(iv); }, []);

  let statusText = t.notSyncedStatus;
  let statusColor = INK_SOFT;
  if (fbUser) {
    if (syncStatus === 'syncing') { statusText = t.syncing; statusColor = ACCENT; }
    else if (syncStatus === 'synced') { statusText = t.synced; statusColor = MINT; }
    else if (syncStatus === 'error') { statusText = t.syncErrorStatus; statusColor = DANGER; }
  }
  const lastSyncedText = fbUser && lastSyncedAt ? formatRelativeSync(lastSyncedAt, t) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl p-5 flex flex-col items-center gap-1.5 text-center" style={glass()}>
        <span className="text-base font-black" style={{ color: statusColor }}>{statusText}</span>
        {lastSyncedText && <span className="text-xs" style={{ color: INK_SOFT }}>{lastSyncedText}</span>}
      </div>
      {!fbUser ? (
        <>
          <p className="text-sm" style={{ color: INK_SOFT }}>{t.syncLoginHint}</p>
          <button onClick={onOpenAuth} className="py-3 rounded-xl text-sm font-bold" style={{ background: ACCENT, color: '#fff' }}>{t.login}</button>
        </>
      ) : (
        syncStatus === 'error' && <p className="text-xs font-bold" style={{ color: DANGER }}>{t.syncErrorHint}</p>
      )}
    </div>
  );
}
