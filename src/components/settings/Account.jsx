import { useState, useEffect, useRef } from 'react';
import { X, Pencil, User, LogOut, Mail, Eye, EyeOff, Shield } from 'lucide-react';
import {
  signUpWithEmail, signInWithEmail, signInWithGoogle, signInWithApple, sendMagicLink, signOutUser, getCurrentUserProviderId, changePassword, deleteAccount,
} from '../../lib/auth.js';
import { collectAllAlbumPhotos, resolveAlbumsField } from '../album/Album.jsx';
import { BackupSection, encryptBackupText, parseBackupPayload } from './Backup.jsx';
import { SettingsGroupCard, SettingsRow } from './Settings.jsx';
import { ACCENT, AUTH_GLASS, CARD_BORDER, DANGER, INK, INK_SOFT, INPUT_BG, MINT, glass } from '../../constants/colors.js';
import { useModalBackClose } from '../../hooks/useModalBackClose.js';
import { useIsLargeScreen } from '../../hooks/useOverlayTransition.js';
import { accentAlpha } from '../../utils/accentAlpha.js';
import { isLikelyMainlandChinaUser } from '../../utils/timezone.js';

export const SHOW_APPLE_LOGIN = false;

export const INVITE_KEY = 'beta-access-granted-v1';

export const VALID_INVITE_HASHES = [
  // 'e3b0c44298fc1c14...',  // 範例：每個邀請碼的雜湊值佔一行
];

export async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text.trim().toUpperCase());
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyInviteCode(code) {
  if (!code || !code.trim()) return { ok: false };
  const hash = await sha256Hex(code);
  return { ok: VALID_INVITE_HASHES.includes(hash) };

  // ---- Phase 2（Cloudflare Worker）替換範例 ----
  // const res = await fetch('https://your-worker.example.workers.dev/redeem', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ code: code.trim() }),
  // });
  // if (!res.ok) return { ok: false };
  // const data = await res.json();
  // return { ok: !!data.ok, token: data.token };
}

export function GoogleGIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.8741 2.6836-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.4673-.8064 5.9564-2.1818l-2.9087-2.2581c-.8064.54-1.8368.8591-3.0477.8591-2.3446 0-4.3282-1.5831-5.0359-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z" />
      <path fill="#FBBC05" d="M3.9641 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9573A8.9965 8.9965 0 000 9c0 1.4527.3477 2.8268.9573 4.0418L3.9641 10.71z" />
      <path fill="#EA4335" d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.9641 7.29C4.6718 5.1627 6.6555 3.5795 9 3.5795z" />
    </svg>
  );
}

export function PasswordField({ inputRef, value, onChange, onKeyDown, placeholder, t, className, style }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        ref={inputRef}
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        className={className}
        style={{ ...style, paddingRight: 38 }}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? t.hidePassword : t.showPassword}
        className="absolute right-0 top-0 h-full flex items-center px-2.5"
        style={{ color: INK_SOFT }}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export function AuthModal({ lang, t, user, onClose, backupData, onImportBackup }) {
  // 大屏（折叠屏展开／平板／桌面）下把視窗card稍微加寬一些，比例更接近桌面軟體的置中對話框，
  // 不像手機那樣窄窄一條；由於這裡的視窗本來就已經是「置中顯示」（fixed inset-0 + items-center），
  // 所以只需要放寬 max-width，不需要改變彈出方式或位置。
  const isLargeScreen = useIsLargeScreen();
  const [modalPhase, setModalPhase] = useState('enter');
  const AUTH_MODAL_DURATION = 60;
  useEffect(() => {
    const id = requestAnimationFrame(() => setModalPhase('shown'));
    return () => cancelAnimationFrame(id);
  }, []);
  function handleClose() {
    if (modalPhase === 'closing') return;
    setModalPhase('closing');
    setTimeout(onClose, AUTH_MODAL_DURATION);
  }
  useModalBackClose(true, handleClose);
  const modalShown = modalPhase === 'shown';
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [magicSent, setMagicSent] = useState(false);
  // 是否偵測為中國大陸用戶：只在「尚未登入」的登入／註冊頁面擋下，已登入的帳號管理畫面不受影響
  const [cnBlocked] = useState(() => isLikelyMainlandChinaUser());

  // ---- 本機備份（匯出／匯入）：雲端同步在中國大陸連不上時的替代方案 ----
  // 直接把目前的 clocks／events／lang／isDark／customIcons 整包輸出，
  // 需要的時候再走同一套 applyCloudData 邏輯還原回來。
  //
  // Android 上單純觸發 <a download> 存成 .tzzwnb 檔，使用者常常找不到檔案存去哪了（下載資料夾要另外搜尋，
  // 門檻很高）。改成優先使用 Web Share API（navigator.share 帶 file），直接叫出系統原生的分享面板，
  // 使用者可以直接選「傳送給自己」「儲存到雲端硬碟」「記事本」等——不需要碰檔案總管。
  // 不支援 Web Share 的瀏覽器（多半是桌面版）才退回原本的 <a download> 下載方式。
  const importFileRef = useRef(null);
  const [backupMsg, setBackupMsg] = useState(null); // { type: 'success' | 'error', text }

  // 相片是「盡力而為」附加進備份檔：從各相冊各自的 window.storage key 收集起來，跟骨架資料一起打包。
  // 用 collectAllAlbumPhotos（跟雲端同步共用同一支函式）；匯入端也已經在共用的 applyCloudData
  // 裡處理過 albumPhotos 欄位了，所以匯入這邊完全不用另外改。
  async function buildBackupPayloadWithPhotos() {
    const albumPhotos = await collectAllAlbumPhotos(backupData.albums && backupData.albums.length ? backupData.albums : resolveAlbumsField(backupData));
    return { ...backupData, ...(Object.keys(albumPhotos).length ? { albumPhotos } : {}), exportedAt: Date.now() };
  }

  async function parseAndImport(fileText) {
    const data = await parseBackupPayload(fileText);
    if (!data) {
      setBackupMsg({ type: 'error', text: t.backupImportError });
      return false;
    }
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

    // 優先走系統分享面板（手機上最直覺，不用自己去下載資料夾找檔案）
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        setBackupMsg({ type: 'success', text: t.backupExportSuccess });
        return;
      } catch (err) {
        // 使用者取消分享，或裝置不支援帶檔案分享：不當成錯誤，繼續往下退回下載方式
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setBackupMsg({ type: 'success', text: t.backupExportSuccess });
  }

  function handleImportFileChange(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // 允許連續匯入同一個檔案時也能觸發 change
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => parseAndImport(String(reader.result));
    reader.onerror = () => setBackupMsg({ type: 'error', text: t.backupImportError });
    reader.readAsText(file);
  }

  // 已登入帳號管理：主畫面／修改密碼／註銷確認
  const [view, setView] = useState('main');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  // 鍵盤操作：Enter／方向鍵向下 可以切換到下一個欄位，方向鍵向上可以回到上一個欄位，最後一欄按 Enter 直接送出
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);
  const currentPasswordRef = useRef(null);
  const newPasswordRef = useRef(null);
  const confirmNewPasswordRef = useRef(null);

  function stepToNext(nextRef, onSubmit, prevRef) {
    return (e) => {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (nextRef && nextRef.current) nextRef.current.focus();
        else if (onSubmit) onSubmit();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (prevRef && prevRef.current) prevRef.current.focus();
      }
    };
  }

  async function run(fn) {
    setBusy(true);
    setError('');
    // Firebase 的請求在部分網路環境下可能連不上、卡在內部重試／等待逾時，
    // 使用者畫面上就是「一直轉圈、不知道發生什麼事」。
    // 這裡自己加一個 8 秒的逾時，超過就先把畫面還給使用者，顯示這個功能目前無法使用、
    // 請聯繫開發者，而不是讓 Firebase 自己的（更長的）逾時機制決定使用者要等多久。
    // 注意：timedOut 要宣告在 try 區塊外面，因為 let／const 是區塊作用域，
    // 宣告在 try{} 裡面的話，下面 catch{} 區塊是完全存取不到的。
    let timedOut = false;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => { timedOut = true; reject(new Error('timeout')); }, 8000);
      });
      await Promise.race([fn(), timeoutPromise]);
    } catch (err) {
      setError(timedOut ? t.authTimeout : t.authError);
    }
    setBusy(false);
  }

  function handleSubmit() {
    if (mode === 'signup' && password !== confirmPassword) {
      setError(t.passwordMismatch);
      return;
    }
    run(async () => {
      if (mode === 'login') await signInWithEmail(email, password);
      else await signUpWithEmail(email, password);
    });
  }

  function handleChangePassword() {
    if (newPassword !== confirmNewPassword) {
      setError(t.passwordMismatch);
      return;
    }
    run(async () => {
      await changePassword(currentPassword, newPassword);
      setPwSuccess(true);
      setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('');
    });
  }

  if (user) {
    const providerId = getCurrentUserProviderId();
    const methodLabel = providerId === 'google.com' ? t.loginMethodGoogle : providerId === 'apple.com' ? t.loginMethodApple : t.loginMethodEmail;

    if (view === 'changePassword') {
      return (
        <div className="fixed inset-0 flex items-center justify-center px-6" style={{
            zIndex: 200,
            background: modalShown ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
            transition: `background ${AUTH_MODAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          }} onClick={handleClose}>
          <div className={`w-full ${isLargeScreen ? 'max-w-sm' : 'max-w-xs'} p-6 rounded-2xl flex flex-col gap-3`} style={{
              ...AUTH_GLASS,
              opacity: modalShown ? 1 : 0,
              transform: modalShown ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
              transition: `opacity ${AUTH_MODAL_DURATION}ms ease, transform ${AUTH_MODAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black" style={{ color: INK }}>{t.changePassword}</h2>
              <button onClick={handleClose} style={{ color: INK_SOFT }}><X size={18} /></button>
            </div>
            <PasswordField
              inputRef={currentPasswordRef} t={t}
              placeholder={t.currentPassword} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
              onKeyDown={stepToNext(newPasswordRef, null, null)}
              className="px-3 py-2.5 rounded-xl text-sm outline-none w-full"
              style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }}
            />
            <PasswordField
              inputRef={newPasswordRef} t={t}
              placeholder={t.newPassword} value={newPassword} onChange={e => setNewPassword(e.target.value)}
              onKeyDown={stepToNext(confirmNewPasswordRef, null, currentPasswordRef)}
              className="px-3 py-2.5 rounded-xl text-sm outline-none w-full"
              style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }}
            />
            <PasswordField
              inputRef={confirmNewPasswordRef} t={t}
              placeholder={t.confirmNewPassword} value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)}
              onKeyDown={stepToNext(null, handleChangePassword, newPasswordRef)}
              className="px-3 py-2.5 rounded-xl text-sm outline-none w-full"
              style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }}
            />
            {error && <p className="text-xs font-bold" style={{ color: DANGER }}>{error}</p>}
            {pwSuccess && <p className="text-xs font-bold" style={{ color: MINT }}>{t.passwordChangeSuccess}</p>}
            <button
              onClick={handleChangePassword}
              disabled={busy || !currentPassword || !newPassword || !confirmNewPassword}
              className="py-2.5 rounded-xl font-bold text-sm"
              style={{ background: MINT, color: '#fff', opacity: busy || !currentPassword || !newPassword || !confirmNewPassword ? 0.6 : 1 }}
            >
              {t.saveChangesBtn}
            </button>
            <button
              onClick={() => { setView('main'); setError(''); setPwSuccess(false); }}
              className="text-xs font-bold"
              style={{ color: ACCENT }}
            >
              {t.back}
            </button>
          </div>
        </div>
      );
    }

    if (view === 'deleteConfirm') {
      return (
        <div className="fixed inset-0 flex items-center justify-center px-6" style={{
            zIndex: 200,
            background: modalShown ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
            transition: `background ${AUTH_MODAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          }} onClick={handleClose}>
          <div className={`w-full ${isLargeScreen ? 'max-w-sm' : 'max-w-xs'} p-6 rounded-2xl flex flex-col gap-3`} style={{
              ...AUTH_GLASS,
              opacity: modalShown ? 1 : 0,
              transform: modalShown ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
              transition: `opacity ${AUTH_MODAL_DURATION}ms ease, transform ${AUTH_MODAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black" style={{ color: DANGER }}>{t.deleteAccountConfirmTitle}</h2>
              <button onClick={handleClose} style={{ color: INK_SOFT }}><X size={18} /></button>
            </div>
            <p className="text-sm" style={{ color: INK }}>{t.deleteAccountConfirmDesc}</p>
            {providerId === 'password' && (
              <PasswordField
                t={t}
                placeholder={t.currentPassword} value={deletePassword} onChange={e => setDeletePassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); run(async () => { await deleteAccount(deletePassword); handleClose(); }); } }}
                className="px-3 py-2.5 rounded-xl text-sm outline-none w-full"
                style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }}
              />
            )}
            {error && <p className="text-xs font-bold" style={{ color: DANGER }}>{error}</p>}
            <button
              onClick={() => run(async () => { await deleteAccount(deletePassword); handleClose(); })}
              disabled={busy || (providerId === 'password' && !deletePassword)}
              className="py-2.5 rounded-xl font-bold text-sm"
              style={{ background: DANGER, color: '#fff', opacity: busy || (providerId === 'password' && !deletePassword) ? 0.6 : 1 }}
            >
              {t.confirmDelete}
            </button>
            <button
              onClick={() => { setView('main'); setError(''); }}
              className="text-xs font-bold"
              style={{ color: ACCENT }}
            >
              {t.cancel}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 flex items-center justify-center px-6" style={{
            zIndex: 200,
            background: modalShown ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
            transition: `background ${AUTH_MODAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          }} onClick={handleClose}>
        <div className={`w-full ${isLargeScreen ? 'max-w-sm' : 'max-w-xs'} p-6 rounded-2xl flex flex-col gap-4`} style={{
              ...AUTH_GLASS,
              opacity: modalShown ? 1 : 0,
              transform: modalShown ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
              transition: `opacity ${AUTH_MODAL_DURATION}ms ease, transform ${AUTH_MODAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            }} onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black" style={{ color: INK }}>{t.account}</h2>
            <button onClick={handleClose} style={{ color: INK_SOFT }}><X size={18} /></button>
          </div>
          <p className="text-sm" style={{ color: INK }}>{t.loggedInAs(user.email || user.displayName || user.uid)}</p>
          <p className="text-xs font-bold" style={{ color: INK_SOFT }}>{t.loginMethodLabel}：{methodLabel}</p>

          {providerId === 'password' && (
            <button
              onClick={() => { setView('changePassword'); setError(''); setPwSuccess(false); }}
              className="py-2.5 rounded-xl font-bold text-sm"
              style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }}
            >
              {t.changePassword}
            </button>
          )}

          <BackupSection t={t} handleExportBackup={handleExportBackup} importFileRef={importFileRef} handleImportFileChange={handleImportFileChange} backupMsg={backupMsg} />

          <button
            onClick={() => run(async () => { await signOutUser(); handleClose(); })}
            disabled={busy}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm"
            style={{ background: DANGER, color: '#fff', opacity: busy ? 0.6 : 1 }}
          >
            <LogOut size={15} /> {t.logout}
          </button>

          <button
            onClick={() => { setView('deleteConfirm'); setError(''); setDeletePassword(''); }}
            className="text-xs font-bold"
            style={{ color: DANGER }}
          >
            {t.deleteAccount}
          </button>
        </div>
      </div>
    );
  }

  if (cnBlocked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center px-6" style={{
            zIndex: 200,
            background: modalShown ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
            transition: `background ${AUTH_MODAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          }} onClick={handleClose}>
        <div className={`w-full ${isLargeScreen ? 'max-w-sm' : 'max-w-xs'} p-6 rounded-2xl flex flex-col gap-3`} style={{
              ...AUTH_GLASS,
              opacity: modalShown ? 1 : 0,
              transform: modalShown ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
              transition: `opacity ${AUTH_MODAL_DURATION}ms ease, transform ${AUTH_MODAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            }} onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black" style={{ color: INK }}>{t.loginToSync}</h2>
            <button onClick={handleClose} style={{ color: INK_SOFT }}><X size={18} /></button>
          </div>
          <p className="text-sm font-bold" style={{ color: DANGER }}>{t.mainlandCnBlocked}</p>
          <BackupSection t={t} handleExportBackup={handleExportBackup} importFileRef={importFileRef} handleImportFileChange={handleImportFileChange} backupMsg={backupMsg} />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center px-6" style={{
            zIndex: 200,
            background: modalShown ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
            transition: `background ${AUTH_MODAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          }} onClick={handleClose}>
      <div className={`w-full ${isLargeScreen ? 'max-w-sm' : 'max-w-xs'} p-6 rounded-2xl flex flex-col gap-3`} style={{
              ...AUTH_GLASS,
              opacity: modalShown ? 1 : 0,
              transform: modalShown ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
              transition: `opacity ${AUTH_MODAL_DURATION}ms ease, transform ${AUTH_MODAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black" style={{ color: INK }}>{t.loginToSync}</h2>
          <button onClick={handleClose} style={{ color: INK_SOFT }}><X size={18} /></button>
        </div>

        <button
          onClick={() => run(signInWithGoogle)}
          disabled={busy}
          className="flex items-center justify-center gap-2.5 py-2.5 rounded-full font-bold text-sm"
          style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(60,64,67,0.25)', color: INK, opacity: busy ? 0.6 : 1 }}
        >
          <GoogleGIcon /> {t.continueWithGoogle}
        </button>
        {SHOW_APPLE_LOGIN && (
          <button
            onClick={() => run(signInWithApple)}
            disabled={busy}
            className="py-2.5 rounded-xl font-bold text-sm"
            style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK, opacity: busy ? 0.6 : 1 }}
          >
            {t.continueWithApple}
          </button>
        )}

        <div className="flex items-center gap-2 my-1">
          <div className="flex-1 h-px" style={{ background: 'var(--card-border)' }} />
          <span className="text-xs" style={{ color: INK_SOFT }}>{t.orDivider}</span>
          <div className="flex-1 h-px" style={{ background: 'var(--card-border)' }} />
        </div>

        <input
          ref={emailRef}
          type="email" placeholder={t.email} value={email} onChange={e => setEmail(e.target.value)}
          onKeyDown={stepToNext(passwordRef, null, null)}
          className="px-3 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }}
        />
        <PasswordField
          inputRef={passwordRef} t={t}
          placeholder={t.password} value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={stepToNext(mode === 'signup' ? confirmPasswordRef : null, handleSubmit, emailRef)}
          className="px-3 py-2.5 rounded-xl text-sm outline-none w-full"
          style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }}
        />
        {mode === 'signup' && (
          <PasswordField
            inputRef={confirmPasswordRef} t={t}
            placeholder={t.confirmPassword} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
            onKeyDown={stepToNext(null, handleSubmit, passwordRef)}
            className="px-3 py-2.5 rounded-xl text-sm outline-none w-full"
            style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }}
          />
        )}
        {error && <p className="text-xs font-bold" style={{ color: DANGER }}>{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={busy || !email || !password || (mode === 'signup' && !confirmPassword)}
          className="py-2.5 rounded-xl font-bold text-sm"
          style={{ background: MINT, color: '#fff', opacity: busy || !email || !password || (mode === 'signup' && !confirmPassword) ? 0.6 : 1 }}
        >
          {mode === 'login' ? t.login : t.signup}
        </button>
        <button
          onClick={() => { setMode(m => (m === 'login' ? 'signup' : 'login')); setConfirmPassword(''); setError(''); }}
          className="text-xs font-bold"
          style={{ color: ACCENT }}
        >
          {mode === 'login' ? t.switchToSignup : t.switchToLogin}
        </button>

        <div className="flex items-center gap-2 my-1">
          <div className="flex-1 h-px" style={{ background: 'var(--card-border)' }} />
          <span className="text-xs" style={{ color: INK_SOFT }}>{t.orDivider}</span>
          <div className="flex-1 h-px" style={{ background: 'var(--card-border)' }} />
        </div>

        {magicSent ? (
          <p className="text-xs font-bold text-center" style={{ color: MINT }}>{t.magicLinkSent}</p>
        ) : (
          <button
            onClick={() => run(async () => { await sendMagicLink(email); setMagicSent(true); })}
            disabled={busy || !email}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm"
            style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK, opacity: busy || !email ? 0.6 : 1 }}
          >
            <Mail size={15} /> {t.sendMagicLink}
          </button>
        )}

        <BackupSection t={t} handleExportBackup={handleExportBackup} importFileRef={importFileRef} handleImportFileChange={handleImportFileChange} backupMsg={backupMsg} />
      </div>
    </div>
  );
}

export function MergeDialog({ t, onResolve }) {
  const isLargeScreen = useIsLargeScreen();
  const [phase, setPhase] = useState('enter');
  const MERGE_MODAL_DURATION = 60;
  useEffect(() => {
    const id = requestAnimationFrame(() => setPhase('shown'));
    return () => cancelAnimationFrame(id);
  }, []);
  const shown = phase === 'shown';
  function handleResolve(result) {
    if (phase === 'closing') return;
    setPhase('closing');
    setTimeout(() => onResolve(result), MERGE_MODAL_DURATION);
  }
  return (
    <div className="fixed inset-0 flex items-center justify-center px-6" style={{
        zIndex: 210,
        background: shown ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)',
        transition: `background ${MERGE_MODAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
      }}>
      <div className={`w-full ${isLargeScreen ? 'max-w-sm' : 'max-w-xs'} p-6 rounded-2xl flex flex-col gap-3`} style={{
          ...AUTH_GLASS,
          opacity: shown ? 1 : 0,
          transform: shown ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
          transition: `opacity ${MERGE_MODAL_DURATION}ms ease, transform ${MERGE_MODAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }}>
        <h2 className="text-lg font-black" style={{ color: INK }}>{t.mergeTitle}</h2>
        <p className="text-sm" style={{ color: INK_SOFT }}>{t.mergeDesc}</p>
        <button onClick={() => handleResolve('merge')} className="py-2.5 rounded-xl font-bold text-sm" style={{ background: MINT, color: '#fff' }}>
          {t.mergeOptionMerge}
        </button>
        <button onClick={() => handleResolve('cloud')} className="py-2.5 rounded-xl font-bold text-sm" style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }}>
          {t.mergeOptionUseCloud}
        </button>
        <button onClick={() => handleResolve('local')} className="py-2.5 rounded-xl font-bold text-sm" style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }}>
          {t.mergeOptionUseLocal}
        </button>
      </div>
    </div>
  );
}

export function InviteGate({ lang, t, onUnlocked }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (checking) return;
    setChecking(true);
    setError('');
    try {
      const result = await verifyInviteCode(code);
      if (result.ok) {
        await window.storage.set(INVITE_KEY, 'true', false).catch(() => {});
        onUnlocked();
      } else {
        setError(t.inviteInvalid);
      }
    } catch (err) {
      setError(t.inviteInvalid);
    }
    setChecking(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--page-bg)', fontFamily: "'Inter', sans-serif" }}>
      <form onSubmit={handleSubmit} className="w-full max-w-xs p-6 rounded-2xl flex flex-col gap-3" style={{ background: 'var(--card-bg)', border: CARD_BORDER }}>
        <h1 className="text-lg font-black" style={{ color: INK }}>{t.inviteTitle}</h1>
        <p className="text-sm" style={{ color: INK_SOFT }}>{t.inviteSubtitle}</p>
        <input
          type="text"
          autoFocus
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder={t.invitePlaceholder}
          className="px-3 py-2 rounded-lg text-sm w-full outline-none"
          style={{ border: CARD_BORDER, background: INPUT_BG, color: INK }}
        />
        {error && <p className="text-xs font-medium" style={{ color: DANGER }}>{error}</p>}
        <button
          type="submit"
          disabled={checking || !code.trim()}
          className="px-3 py-2 rounded-lg text-sm font-bold text-white"
          style={{ background: MINT, opacity: checking || !code.trim() ? 0.6 : 1 }}
        >
          {checking ? t.inviteChecking : t.inviteSubmit}
        </button>
      </form>
    </div>
  );
}

export function ProfileAvatar({ fbUser, size = 48 }) {
  const source = (fbUser && (fbUser.displayName || fbUser.email)) || '';
  const initial = source.trim().charAt(0).toUpperCase();
  return (
    <span
      className="relative flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center font-black"
      style={{ width: size, height: size, background: accentAlpha('22'), color: ACCENT, fontSize: Math.round(size * 0.4) }}
    >
      {fbUser && fbUser.photoURL
        ? <img src={fbUser.photoURL} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
        : (initial || <User size={Math.round(size * 0.5)} />)}
    </span>
  );
}

export function AccountManagementPage({ t, fbUser, onClose }) {
  const [view, setView] = useState('main'); // 'main' | 'password' | 'delete'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  if (!fbUser) return null;
  const providerId = getCurrentUserProviderId();
  const methodLabel = providerId === 'google.com' ? t.loginMethodGoogle : providerId === 'apple.com' ? t.loginMethodApple : t.loginMethodEmail;

  async function run(fn) {
    setBusy(true); setError('');
    let timedOut = false;
    try {
      const timeoutPromise = new Promise((_, reject) => { setTimeout(() => { timedOut = true; reject(new Error('timeout')); }, 8000); });
      await Promise.race([fn(), timeoutPromise]);
    } catch (err) {
      setError(timedOut ? t.authTimeout : t.authError);
    }
    setBusy(false);
  }

  function handleChangePassword() {
    if (newPassword !== confirmNewPassword) { setError(t.passwordMismatch); return; }
    run(async () => {
      await changePassword(currentPassword, newPassword);
      setPwSuccess(true);
      setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('');
    });
  }

  if (view === 'password') {
    return (
      <div className="flex flex-col gap-3">
        <PasswordField t={t} placeholder={t.currentPassword} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm outline-none w-full" style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }} />
        <PasswordField t={t} placeholder={t.newPassword} value={newPassword} onChange={e => setNewPassword(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm outline-none w-full" style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }} />
        <PasswordField t={t} placeholder={t.confirmNewPassword} value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm outline-none w-full" style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }} />
        {error && <p className="text-xs font-bold" style={{ color: DANGER }}>{error}</p>}
        {pwSuccess && <p className="text-xs font-bold" style={{ color: MINT }}>{t.passwordChangeSuccess}</p>}
        <button
          onClick={handleChangePassword}
          disabled={busy || !currentPassword || !newPassword || !confirmNewPassword}
          className="py-2.5 rounded-xl font-bold text-sm"
          style={{ background: MINT, color: '#fff', opacity: busy || !currentPassword || !newPassword || !confirmNewPassword ? 0.6 : 1 }}
        >
          {t.saveChangesBtn}
        </button>
        <button onClick={() => { setView('main'); setError(''); setPwSuccess(false); }} className="text-xs font-bold self-start" style={{ color: ACCENT }}>{t.back}</button>
      </div>
    );
  }

  if (view === 'delete') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm" style={{ color: INK }}>{t.deleteAccountConfirmDesc}</p>
        {providerId === 'password' && (
          <PasswordField t={t} placeholder={t.currentPassword} value={deletePassword} onChange={e => setDeletePassword(e.target.value)}
            className="px-3 py-2.5 rounded-xl text-sm outline-none w-full" style={{ background: 'var(--input-bg)', border: CARD_BORDER, color: INK }} />
        )}
        {error && <p className="text-xs font-bold" style={{ color: DANGER }}>{error}</p>}
        <button
          onClick={() => run(async () => { await deleteAccount(deletePassword); onClose(); })}
          disabled={busy || (providerId === 'password' && !deletePassword)}
          className="py-2.5 rounded-xl font-bold text-sm"
          style={{ background: DANGER, color: '#fff', opacity: busy || (providerId === 'password' && !deletePassword) ? 0.6 : 1 }}
        >
          {t.confirmDelete}
        </button>
        <button onClick={() => { setView('main'); setError(''); }} className="text-xs font-bold self-start" style={{ color: ACCENT }}>{t.cancel}</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <ProfileAvatar fbUser={fbUser} size={56} />
        <div className="flex-1 min-w-0">
          <p className="text-base font-black truncate" style={{ color: INK }}>{fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : t.account)}</p>
          {fbUser.email && <p className="text-xs truncate" style={{ color: INK_SOFT }}>{fbUser.email}</p>}
        </div>
      </div>

      <SettingsGroupCard title={t.accountSecurityLabel}>
        <SettingsRow isFirst icon={<Shield size={18} />} label={t.loginMethodLabel} right={<span className="text-xs font-bold" style={{ color: INK_SOFT }}>{methodLabel}</span>} />
        {providerId === 'password' && (
          <SettingsRow icon={<Pencil size={18} />} label={t.changePassword} onClick={() => { setView('password'); setError(''); setPwSuccess(false); }} />
        )}
      </SettingsGroupCard>

      {error && <p className="text-xs font-bold" style={{ color: DANGER }}>{error}</p>}

      <button
        onClick={() => run(async () => { await signOutUser(); onClose(); })}
        disabled={busy}
        className="flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm"
        style={{ ...glass(), color: INK, opacity: busy ? 0.6 : 1 }}
      >
        <LogOut size={16} /> {t.logout}
      </button>

      <button onClick={() => { setView('delete'); setError(''); setDeletePassword(''); }} className="text-xs font-bold self-center" style={{ color: DANGER }}>
        {t.deleteAccount}
      </button>
    </div>
  );
}
