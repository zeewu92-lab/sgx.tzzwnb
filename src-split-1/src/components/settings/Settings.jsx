import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, X, Globe, Sun, User, Mail, Bell, BellOff, Calendar, Info, Database, RefreshCw } from 'lucide-react';
import { collectAllAlbumPhotos } from '../album/Album.jsx';
import { MarkdownBody } from './About.jsx';
import { AccountManagementPage, ProfileAvatar } from './Account.jsx';
import { AppearanceChoiceContent } from './Appearance.jsx';
import { BackupDataPage, SyncDataPage } from './Backup.jsx';
import { CalendarPrefChoiceContent, LanguageChoiceContent } from './Language.jsx';
import { ACCENT, AUTH_GLASS, CARD_BORDER, DANGER, INK, INK_SOFT, glass } from '../../constants/colors.js';
import { LANG_NAMES } from '../../constants/languages.js';
import { useModalBackClose } from '../../hooks/useModalBackClose.js';
import { openDropdownExclusive, useExclusiveDropdown } from '../../hooks/useOverlayTransition.js';
import { accentAlpha } from '../../utils/accentAlpha.js';

export function NotifySettingsButton({ enabled, onToggle, daysBefore, setDaysBefore, permission, t }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useExclusiveDropdown('notify', open, () => setOpen(false));

  const unsupported = permission === 'unsupported';

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(v => {
          const next = !v;
          if (next) openDropdownExclusive('notify');
          return next;
        })}
        aria-label={t.notifyButtonLabel}
        title={t.notifyButtonLabel}
        className="flex items-center justify-center rounded-full flex-shrink-0"
        style={{ ...glass(), width: '2.125rem', height: '2.125rem', color: enabled ? ACCENT : INK }}
      >
        {enabled ? <Bell size={16} /> : <BellOff size={16} />}
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 rounded-xl overflow-hidden z-20 p-4 flex flex-col gap-3"
          style={{ ...glass(), width: 250, boxShadow: '0 10px 30px rgba(35,39,51,0.15)' }}
          onClick={e => e.stopPropagation()}
        >
          <p className="text-sm font-bold" style={{ color: INK }}>{t.notifyPanelTitle}</p>

          <div className="flex items-center justify-between gap-2">
            <span className="text-sm" style={{ color: INK }}>{t.notifyEnableLabel}</span>
            <button
              onClick={() => onToggle(!enabled)}
              className="relative flex-shrink-0"
              style={{ width: 40, height: 24, borderRadius: 12, background: enabled ? ACCENT : 'var(--card-border)', transition: 'background 0.2s ease' }}
            >
              <span
                className="absolute rounded-full bg-white"
                style={{ width: 18, height: 18, top: 3, left: enabled ? 19 : 3, transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
              />
            </button>
          </div>
          <p className="text-xs" style={{ color: INK_SOFT }}>{t.notifyEnableHint}</p>

          <div className="flex items-center justify-between gap-2">
            <span className="text-sm" style={{ color: INK }}>{t.notifyDaysBeforeLabel}</span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <input
                type="number"
                min={0}
                max={365}
                value={daysBefore}
                onChange={e => {
                  const v = parseInt(e.target.value, 10);
                  setDaysBefore(Number.isFinite(v) ? Math.max(0, Math.min(365, v)) : 0);
                }}
                className="text-sm text-center rounded-lg px-2 py-1"
                style={{ width: 52, background: 'var(--card-border)', color: INK, border: 'none' }}
              />
              <span className="text-xs" style={{ color: INK_SOFT }}>{t.notifyDaysBeforeUnit}</span>
            </div>
          </div>

          {unsupported && <p className="text-xs font-medium" style={{ color: DANGER }}>{t.notifyUnsupported}</p>}
          {permission === 'denied' && <p className="text-xs font-medium" style={{ color: DANGER }}>{t.notifyPermissionDenied}</p>}
        </div>
      )}
    </div>
  );
}

export function SettingsChoiceModal({ title, onClose, children }) {
  const [modalPhase, setModalPhase] = useState('enter');
  const DURATION = 160;
  useEffect(() => { const id = requestAnimationFrame(() => setModalPhase('shown')); return () => cancelAnimationFrame(id); }, []);
  function handleClose() {
    if (modalPhase === 'closing') return;
    setModalPhase('closing');
    setTimeout(onClose, DURATION);
  }
  useModalBackClose(true, handleClose);
  const shown = modalPhase === 'shown';
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center px-6"
      style={{
        zIndex: 300, // 高於 App 裡其他彈窗，確保一定疊在最上層
        background: shown ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
        transition: `background ${DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
      }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-xs p-5 rounded-2xl flex flex-col gap-3"
        style={{
          ...AUTH_GLASS,
          opacity: shown ? 1 : 0,
          transform: shown ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
          transition: `opacity ${DURATION}ms ease, transform ${DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between flex-shrink-0">
          <h2 className="text-base font-black" style={{ color: INK }}>{title}</h2>
          <button onClick={handleClose} aria-label="close" style={{ color: INK_SOFT }}><X size={16} /></button>
        </div>
        {/* 帳戶管理／本機備份等內容較多的視窗內文，這裡統一給一個上限高度＋自己捲動，
            避免內容比手機螢幕還高時把視窗撐出畫面外。 */}
        <div className="max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body
  );
}

export function NotifyChoiceContent({ enabled, onToggle, daysBefore, setDaysBefore, permission, t }) {
  const unsupported = permission === 'unsupported';
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold" style={{ color: INK }}>{t.notifyEnableLabel}</span>
        <button
          onClick={() => onToggle(!enabled)}
          className="relative flex-shrink-0"
          style={{ width: 40, height: 24, borderRadius: 12, background: enabled ? ACCENT : 'var(--card-border)', transition: 'background 0.2s ease' }}
        >
          <span
            className="absolute rounded-full bg-white"
            style={{ width: 18, height: 18, top: 3, left: enabled ? 19 : 3, transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
          />
        </button>
      </div>
      <p className="text-xs" style={{ color: INK_SOFT }}>{t.notifyEnableHint}</p>

      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold" style={{ color: INK }}>{t.notifyDaysBeforeLabel}</span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <input
            type="number"
            min={0}
            max={365}
            value={daysBefore}
            onChange={e => {
              const v = parseInt(e.target.value, 10);
              setDaysBefore(Number.isFinite(v) ? Math.max(0, Math.min(365, v)) : 0);
            }}
            className="text-sm text-center rounded-lg px-2 py-1"
            style={{ width: 52, background: 'var(--card-border)', color: INK, border: 'none' }}
          />
          <span className="text-xs" style={{ color: INK_SOFT }}>{t.notifyDaysBeforeUnit}</span>
        </div>
      </div>

      {unsupported && <p className="text-xs font-medium" style={{ color: DANGER }}>{t.notifyUnsupported}</p>}
      {permission === 'denied' && <p className="text-xs font-medium" style={{ color: DANGER }}>{t.notifyPermissionDenied}</p>}
    </div>
  );
}

export function SettingsRow({ icon, label, onClick, danger, right, isFirst }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      style={{ color: danger ? DANGER : INK, borderTop: isFirst ? 'none' : CARD_BORDER }}
    >
      <span className="flex-shrink-0" style={{ color: danger ? DANGER : INK_SOFT }}>{icon}</span>
      <span className="flex-1 text-sm font-bold truncate">{label}</span>
      {right}
      {onClick && <ChevronRight size={16} style={{ color: INK_SOFT, opacity: 0.55, flexShrink: 0 }} />}
    </Comp>
  );
}

export function SettingsGroupCard({ title, children }) {
  return (
    <div className="flex flex-col gap-2">
      {title && <p className="px-1 text-xs font-bold" style={{ color: INK_SOFT, letterSpacing: '0.02em' }}>{title}</p>}
      <div className="rounded-2xl overflow-hidden" style={glass()}>{children}</div>
    </div>
  );
}

export function ProfilePage({
  t, fbUser, localSaveError, syncStatus, onOpenAuth,
  notifyEnabled, onToggleNotify, notifyDaysBefore, setNotifyDaysBefore, notifyPermission,
  onOpenFeedback, isDark, themeMode, setThemeMode, lang, setLang,
  events, albums, clocks, customIcons, onImportBackup, lastSyncedAt, appVersion,
  enabledAltCalendars, setEnabledAltCalendars,
}) {
  // 「我的」頁除了「我的時光」統計卡片（純展示、不可點擊）以外，所有點擊後彈出新內容的項目
  // （帳戶管理／本機備份／同步與資料／外觀／通知／語言／日曆／關於時光線）都統一用同一個
  // 置中視窗（SettingsChoiceModal）呈現，不再另外區分「獨立滑入子頁面」與「彈出視窗」兩種樣式。
  const [choiceModal, setChoiceModal] = useState(null); // null | 'account' | 'backup' | 'sync' | 'appearance' | 'notify' | 'language' | 'calendar' | 'about'

  const [photoCount, setPhotoCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const photosMap = await collectAllAlbumPhotos(albums || []);
        if (!cancelled) setPhotoCount(Object.values(photosMap).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0));
      } catch (err) { /* 讀取失敗就維持原本的數字，不影響其他區塊 */ }
    })();
    return () => { cancelled = true; };
  }, [albums]);

  const backupData = { clocks, events, lang, isDark, customIcons, albums };
  const hasSyncIssue = localSaveError || syncStatus === 'error';
  const eventCount = events ? events.length : 0;
  const albumCount = albums ? albums.length : 0;

  let syncRightText = t.notSyncedStatus;
  if (fbUser) {
    if (syncStatus === 'syncing') syncRightText = t.syncing;
    else if (syncStatus === 'synced') syncRightText = t.synced;
    else if (syncStatus === 'error') syncRightText = t.syncErrorStatus;
  }

  const appearanceValueText = { system: t.appearanceModeSystem, light: t.appearanceModeLight, dark: t.appearanceModeDark }[themeMode] || t.appearanceModeSystem;
  const notifyValueText = notifyEnabled ? t.darkModeOn : t.darkModeOff;
  // 帳戶管理／本機備份／同步與資料／外觀／通知／語言／日曆／關於時光線，全部共用同一個
  // 置中彈窗（SettingsChoiceModal）與同一個 choiceModal state，只是切換裡面顯示的內容。
  const choiceModalTitle = {
    appearance: t.appearanceLabel, notify: t.notifyPrefLabel, language: t.languageLabel, calendar: t.calendarPrefLabel,
    about: t.aboutLabel, account: t.accountManageLabel, backup: t.backupSectionTitle, sync: t.syncDataLabel,
  }[choiceModal] || '';

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-4 flex flex-col gap-5">
      {/* 一、帳戶區域：置頂、有一定視覺存在感，但不做成大型會員中心 */}
      {fbUser ? (
        <div className="rounded-3xl p-5 flex items-center gap-4" style={glass()}>
          <ProfileAvatar fbUser={fbUser} size={56} />
          <div className="flex-1 min-w-0">
            <p className="text-base font-black truncate" style={{ color: INK }}>{fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : t.account)}</p>
            {fbUser.email && <p className="text-xs truncate" style={{ color: INK_SOFT }}>{fbUser.email}</p>}
          </div>
          <button onClick={() => setChoiceModal('account')} className="relative flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-full flex-shrink-0" style={{ background: accentAlpha('18'), color: ACCENT }}>
            {t.accountManageLabel}
            {hasSyncIssue && <span className="absolute rounded-full" style={{ width: 7, height: 7, top: -1, right: -1, background: DANGER, border: '1.5px solid var(--card-bg)' }} />}
            <ChevronRight size={13} />
          </button>
        </div>
      ) : (
        <button onClick={onOpenAuth} className="rounded-3xl p-5 flex items-center gap-4 text-left w-full" style={glass()}>
          <span className="flex-shrink-0 rounded-full flex items-center justify-center" style={{ width: 56, height: 56, background: accentAlpha('18'), color: ACCENT }}>
            <User size={24} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black" style={{ color: INK }}>{t.loginPromptTitle}</p>
            <p className="text-xs mt-0.5" style={{ color: INK_SOFT }}>{t.loginToSync}</p>
          </div>
          <ChevronRight size={16} style={{ color: INK_SOFT, flexShrink: 0 }} />
        </button>
      )}

      {/* 二、我的時光：簡潔的橫向統計，純展示、不做成可點擊的入口 */}
      <div className="rounded-2xl p-5 flex flex-col gap-3" style={glass()}>
        <span className="text-sm font-black" style={{ color: INK }}>{t.myTimeLabel}</span>
        <div className="flex items-center">
          {[[eventCount, t.myTimeOverviewEvents], [albumCount, t.myTimeOverviewAlbums], [photoCount, t.myTimeOverviewPhotos]].map(([val, label], i) => (
            <div key={label} className="flex-1 flex flex-col items-center gap-0.5" style={{ borderLeft: i === 0 ? 'none' : CARD_BORDER }}>
              <span className="text-lg font-black" style={{ color: ACCENT }}>{val}</span>
              <span className="text-[11px] font-bold" style={{ color: INK_SOFT }}>{label}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px]" style={{ color: INK_SOFT }}>{t.myTimeCaption}</p>
      </div>

      {/* 三、資料 */}
      <SettingsGroupCard title={t.dataGroupLabel}>
        <SettingsRow isFirst icon={<Database size={18} />} label={t.backupSectionTitle} onClick={() => setChoiceModal('backup')} />
        <SettingsRow
          icon={<RefreshCw size={18} />} label={t.syncDataLabel} onClick={() => setChoiceModal('sync')}
          right={<span className="text-xs font-bold" style={{ color: syncStatus === 'error' ? DANGER : INK_SOFT }}>{syncRightText}</span>}
        />
      </SettingsGroupCard>

      {/* 四、偏好 */}
      <SettingsGroupCard title={t.prefGroupLabel}>
        <SettingsRow
          isFirst icon={<Sun size={18} />} label={t.appearanceLabel} onClick={() => setChoiceModal('appearance')}
          right={<span className="text-xs font-bold" style={{ color: INK_SOFT }}>{appearanceValueText}</span>}
        />
        <SettingsRow
          icon={notifyEnabled ? <Bell size={18} /> : <BellOff size={18} />} label={t.notifyPrefLabel} onClick={() => setChoiceModal('notify')}
          right={<span className="text-xs font-bold" style={{ color: INK_SOFT }}>{notifyValueText}</span>}
        />
        <SettingsRow
          icon={<Globe size={18} />} label={t.languageLabel} onClick={() => setChoiceModal('language')}
          right={<span className="text-xs font-bold" style={{ color: INK_SOFT }}>{LANG_NAMES[lang]}</span>}
        />
        <SettingsRow icon={<Calendar size={18} />} label={t.calendarPrefLabel} onClick={() => setChoiceModal('calendar')} />
      </SettingsGroupCard>

      {/* 五、其他：使用條款／隱私權政策已收進「關於時光線」內文的「相關文件」連結，
          這裡不再重複列出獨立選項。 */}
      <SettingsGroupCard title={t.otherGroupLabel}>
        <SettingsRow isFirst icon={<Mail size={18} />} label={t.feedbackLabel} onClick={onOpenFeedback} />
        <SettingsRow icon={<Info size={18} />} label={t.aboutLabel} onClick={() => setChoiceModal('about')} />
      </SettingsGroupCard>

      <div className="flex flex-col items-center gap-0.5 pt-2 pb-2">
        <span className="text-xs font-bold" style={{ color: INK_SOFT }}>時光線</span>
        {appVersion && <span className="text-[11px]" style={{ color: INK_SOFT, opacity: 0.7 }}>Version {appVersion}</span>}
      </div>

      {choiceModal && (
        <SettingsChoiceModal title={choiceModalTitle} onClose={() => setChoiceModal(null)}>
          {choiceModal === 'appearance' && <AppearanceChoiceContent themeMode={themeMode} setThemeMode={setThemeMode} t={t} onClose={() => setChoiceModal(null)} />}
          {choiceModal === 'notify' && (
            <NotifyChoiceContent enabled={notifyEnabled} onToggle={onToggleNotify} daysBefore={notifyDaysBefore} setDaysBefore={setNotifyDaysBefore} permission={notifyPermission} t={t} />
          )}
          {choiceModal === 'language' && <LanguageChoiceContent lang={lang} setLang={setLang} onClose={() => setChoiceModal(null)} />}
          {choiceModal === 'calendar' && (
            <CalendarPrefChoiceContent enabledAltCalendars={enabledAltCalendars} setEnabledAltCalendars={setEnabledAltCalendars} lang={lang} t={t} />
          )}
          {/* 「關於時光線」：內文已包含使用條款／隱私權政策的可點擊連結（見 t.aboutBody），
              用 max-h+overflow-y-auto 包住，避免長文字把視窗撐爆版面，會在視窗內部自己捲動。 */}
          {choiceModal === 'about' && (
            <MarkdownBody text={t.aboutBody} color={INK} colorSoft={INK_SOFT} />
          )}
          {/* 帳戶管理／本機備份／同步與資料：原本用獨立全螢幕子頁面（ProfileSubpageShell）呈現，
              現在統一改成跟外觀／通知／關於一樣的置中視窗，「我的」頁除了「我的時光」統計卡片
              （純展示、本來就不可點擊）以外，所有點擊後彈出新內容的項目都收斂成同一種視窗樣式。 */}
          {choiceModal === 'account' && <AccountManagementPage t={t} fbUser={fbUser} onClose={() => setChoiceModal(null)} />}
          {choiceModal === 'backup' && <BackupDataPage t={t} backupData={backupData} onImportBackup={onImportBackup} />}
          {choiceModal === 'sync' && <SyncDataPage t={t} fbUser={fbUser} syncStatus={syncStatus} lastSyncedAt={lastSyncedAt} onOpenAuth={onOpenAuth} />}
        </SettingsChoiceModal>
      )}
    </div>
  );
}
