import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, ChevronLeft, ChevronRight, X, Check, Settings, Images } from 'lucide-react';
import { PhotoThumb } from './PhotoGrid.jsx';
import { ConfirmSheet } from '../common/ConfirmDialog.jsx';
import { stableStringify } from '../settings/Backup.jsx';
import { ACCENT, AUTH_GLASS, CARD_BORDER, COLOR_TAGS, DANGER, ICONS, INK, INK_SOFT, INPUT_BG, MINT, glass } from '../../constants/colors.js';
import { useModalBackClose } from '../../hooks/useModalBackClose.js';
import { resizeImageFile } from '../../utils/image.js';

export const ALBUM_PHOTOS_PREFIX = 'album-photos:';

export const ALBUMS_KEY = 'countdown-timeline-albums';

export function makeAlbumId() { return `alb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

export function parseAlbumCreatedAt(id) {
  const m = /^alb_(\d+)_/.exec(id || '');
  return m ? parseInt(m[1], 10) : Date.now();
}

export async function loadAlbumPhotosGlobal(albumId) {
  try {
    const res = await window.storage.get(ALBUM_PHOTOS_PREFIX + albumId, false);
    return res && res.value ? JSON.parse(res.value) : [];
  } catch (err) {
    return [];
  }
}

export async function persistAlbumPhotosGlobal(albumId, photos) {
  await window.storage.set(ALBUM_PHOTOS_PREFIX + albumId, JSON.stringify(photos), false);
}

export async function deleteAlbumPhotosGlobal(albumId) {
  try { await window.storage.delete(ALBUM_PHOTOS_PREFIX + albumId, false); } catch (err) { /* 本來就沒有相片，忽略即可 */ }
}

export function deriveAlbumsFromEvents(eventsList) {
  const out = [];
  (eventsList || []).forEach(ev => {
    (ev.albums || []).forEach(a => {
      if (a && a.id != null) out.push({ id: a.id, name: a.name || '', eventId: ev.id, createdAt: parseAlbumCreatedAt(a.id) });
    });
  });
  return out;
}

export function mergeAlbumsList(...lists) {
  const map = new Map();
  lists.forEach(list => (list || []).forEach(a => { if (a && a.id != null) map.set(a.id, { ...map.get(a.id), ...a }); }));
  return Array.from(map.values());
}

export function resolveAlbumsField(data) {
  return mergeAlbumsList(deriveAlbumsFromEvents(data && data.events), (data && data.albums) || []);
}

export async function migrateInlineAlbumPhotos(eventsList) {
  let changed = false;
  const migrated = [];
  for (const ev of eventsList) {
    const albums = ev.albums;
    if (!Array.isArray(albums) || !albums.length) { migrated.push(ev); continue; }
    const hasInlinePhotos = albums.some(a => Array.isArray(a.photos) && a.photos.length);
    if (!hasInlinePhotos) { migrated.push(ev); continue; }
    changed = true;
    const newAlbums = [];
    for (const a of albums) {
      if (Array.isArray(a.photos) && a.photos.length) {
        try { await window.storage.set(ALBUM_PHOTOS_PREFIX + a.id, JSON.stringify(a.photos), false); } catch (err) { /* 留在原地，下次再試 */ }
      }
      const { photos, ...rest } = a;
      newAlbums.push(rest);
    }
    migrated.push({ ...ev, albums: newAlbums });
  }
  return { events: migrated, changed };
}

export function photoSigFromAlbumPhotos(albumPhotos) {
  return stableStringify(Object.keys(albumPhotos || {}).sort().map(id => [id, (albumPhotos[id] || []).map(p => p.id)]));
}

export async function collectAllAlbumPhotos(albumsList) {
  const uniqueIds = Array.from(new Set((albumsList || []).map(a => a && a.id).filter(id => id != null)));
  const result = {};
  await Promise.all(uniqueIds.map(async id => {
    try {
      const res = await window.storage.get(ALBUM_PHOTOS_PREFIX + id, false);
      if (res && res.value) {
        const photos = JSON.parse(res.value);
        if (Array.isArray(photos) && photos.length) result[id] = photos;
      }
    } catch (err) { /* 這個相冊還沒有相片、或讀取失敗，當作沒有即可，不影響其他相冊 */ }
  }));
  return result;
}

export function AlbumsFeature({ events, setEvents, albums, setAlbums, route, setRoute, lang, t, isLargeScreen, onViewEvent }) {
  function goHome() { setRoute({ screen: 'home', detailAlbumId: null, prefillEventId: null }); }
  function goCreate(prefillEventId) { setRoute({ screen: 'create', detailAlbumId: null, prefillEventId: prefillEventId || null }); }
  function goDetail(albumId) { setRoute({ screen: 'detail', detailAlbumId: albumId, prefillEventId: null }); }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {route.screen === 'home' && (
        <AlbumsHomeScreen
          events={events}
          albums={albums}
          t={t}
          onOpenAlbum={goDetail}
          onCreate={() => goCreate(null)}
        />
      )}
      {route.screen === 'create' && (
        <CreateAlbumFlow
          events={events}
          setEvents={setEvents}
          setAlbums={setAlbums}
          t={t}
          prefillEventId={route.prefillEventId}
          onCancel={goHome}
          onDone={albumId => goDetail(albumId)}
        />
      )}
      {route.screen === 'detail' && (
        <AlbumDetailScreen
          album={albums.find(a => a.id === route.detailAlbumId) || null}
          events={events}
          setEvents={setEvents}
          setAlbums={setAlbums}
          t={t}
          isLargeScreen={isLargeScreen}
          onBack={goHome}
          onViewEvent={onViewEvent}
        />
      )}
    </div>
  );
}

export function AlbumsHomeScreen({ events, albums, t, onOpenAlbum, onCreate }) {
  // 「全部／事件相冊／未關聯」篩選——未關聯不是錯誤狀態，只是普通的第三種篩選條件。
  const [filter, setFilter] = useState('all');
  const [photoInfo, setPhotoInfo] = useState({}); // { [albumId]: { count, covers: [dataUrl,...] } }

  // 相冊清單一有變動（新增／刪除／改名不影響這裡，但保守起見一起重新讀取），重新讀一次
  // 每個相冊的相片數量跟前三張封面用的縮圖；相片本體仍然各自存在自己的 storage key。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = {};
      for (const a of albums) {
        const photos = await loadAlbumPhotosGlobal(a.id);
        next[a.id] = { count: photos.length, covers: photos.slice(0, 3).map(p => p.dataUrl) };
      }
      if (!cancelled) setPhotoInfo(next);
    })();
    return () => { cancelled = true; };
  }, [albums]);

  const eventsById = {};
  events.forEach(ev => { eventsById[ev.id] = ev; });

  const visible = albums
    .filter(a => (filter === 'all' ? true : filter === 'linked' ? !!a.eventId : !a.eventId))
    .slice()
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-4 flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-shrink-0 overflow-x-auto">
        <button
          onClick={onCreate}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold whitespace-nowrap flex-shrink-0"
          style={{ background: ACCENT, color: '#fff' }}
        >
          <Plus size={14} /> {t.createAlbumBtn}
        </button>
        {[['all', t.albumFilterAll], ['linked', t.albumFilterLinked], ['unlinked', t.albumFilterUnlinked]].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0"
            style={filter === id ? { background: 'var(--card-border)', color: INK } : { background: 'transparent', color: INK_SOFT }}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-center py-10" style={{ color: INK_SOFT }}>{t.albumHomeEmpty}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {visible.map(a => (
            <AlbumCoverCard
              key={a.id}
              album={a}
              linkedEvent={a.eventId ? eventsById[a.eventId] : null}
              photoCount={(photoInfo[a.id] && photoInfo[a.id].count) || 0}
              coverPhotos={(photoInfo[a.id] && photoInfo[a.id].covers) || []}
              onOpen={() => onOpenAlbum(a.id)}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function AlbumCoverCard({ album, linkedEvent, photoCount, coverPhotos, onOpen, t }) {
  return (
    <button
      onClick={onOpen}
      className="relative rounded-2xl overflow-hidden text-left"
      style={{ aspectRatio: '1 / 1', background: 'var(--card-border)' }}
    >
      {coverPhotos[0] ? (
        <>
          {coverPhotos[2] && (
            <div
              className="absolute inset-0"
              style={{ backgroundImage: `url(${coverPhotos[2]})`, backgroundSize: 'cover', backgroundPosition: 'center', transform: 'rotate(4deg) scale(0.92)', opacity: 0.55 }}
            />
          )}
          {coverPhotos[1] && (
            <div
              className="absolute inset-0"
              style={{ backgroundImage: `url(${coverPhotos[1]})`, backgroundSize: 'cover', backgroundPosition: 'center', transform: 'rotate(-3deg) scale(0.96)', opacity: 0.75 }}
            />
          )}
          <img src={coverPhotos[0]} alt="" className="absolute inset-0 w-full h-full object-cover" />
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" style={{ color: INK_SOFT }}>
          <Images size={26} />
        </div>
      )}
      <div
        className="absolute inset-x-0 bottom-0 px-3 py-2.5"
        style={{ background: 'linear-gradient(to top, rgba(20,20,26,0.62), rgba(20,20,26,0))' }}
      >
        <p className="text-sm font-bold truncate" style={{ color: '#fff' }}>{album.name}</p>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] flex-shrink-0" style={{ color: 'rgba(255,255,255,0.85)' }}>{t.albumPhotoCount(photoCount)}</span>
          {linkedEvent && (
            <span className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>{t.linkedEventBadge(linkedEvent.title)}</span>
          )}
        </div>
      </div>
    </button>
  );
}

export function CreateAlbumFlow({ events, setEvents, setAlbums, t, prefillEventId, onCancel, onDone }) {
  const [step, setStep] = useState(1);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [eventId, setEventId] = useState(prefillEventId || null);
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [showQuickEvent, setShowQuickEvent] = useState(false);
  const fileInputRef = useRef(null);

  async function handleFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    setError('');
    try {
      const newPhotos = [];
      for (const file of files) {
        try {
          const dataUrl = await resizeImageFile(file);
          newPhotos.push({ id: `ph_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, dataUrl });
        } catch (err) {
          setError(t.albumPhotoUploadError);
        }
      }
      if (newPhotos.length) setPhotos(prev => [...prev, ...newPhotos]);
    } finally {
      setUploading(false);
    }
  }
  function removePhoto(id) { setPhotos(prev => prev.filter(p => p.id !== id)); }

  async function finishCreate() {
    const finalName = name.trim() || t.newAlbumPlaceholder;
    const id = makeAlbumId();
    try { await persistAlbumPhotosGlobal(id, photos); } catch (err) { /* 骨架仍然建立，相片留給使用者之後在詳細頁重試新增 */ }
    setAlbums(prev => [...prev, { id, name: finalName, eventId: eventId || null, createdAt: Date.now() }]);
    onDone(id);
  }

  const linkedEventTitle = eventId ? (events.find(e => e.id === eventId) || {}).title : '';

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={() => (step === 1 ? onCancel() : setStep(1))} aria-label={t.back} style={{ color: INK }}>
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-base font-black flex-1 truncate" style={{ color: INK }}>
          {step === 1 ? t.selectPhotosStepTitle : t.createAlbumStepTitle}
        </h2>
      </div>

      {step === 1 ? (
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3">
          <p className="text-xs flex-shrink-0" style={{ color: INK_SOFT }}>
            {photos.length ? t.selectedPhotosCount(photos.length) : t.selectPhotosHint}
          </p>
          {error && <p className="text-xs flex-shrink-0" style={{ color: DANGER }}>{error}</p>}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              disabled={uploading}
              aria-label={t.addPhoto}
              className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1"
              style={{ border: '1.5px dashed var(--card-border)', color: INK_SOFT, background: 'transparent' }}
            >
              <Plus size={18} />
              <span className="text-[10px] font-bold">{t.newPhotoLabel}</span>
            </button>
            {photos.map(p => (
              <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden">
                <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removePhoto(p.id)}
                  className="absolute flex items-center justify-center rounded-full"
                  style={{ top: 4, right: 4, width: 20, height: 20, background: 'rgba(0,0,0,0.5)', color: '#fff' }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFilesSelected} />
          <div className="flex-1" />
          <button
            onClick={() => photos.length && setStep(2)}
            disabled={!photos.length}
            className="w-full py-3 rounded-xl font-bold text-sm flex-shrink-0"
            style={{ background: photos.length ? ACCENT : 'var(--card-border)', color: photos.length ? '#fff' : INK_SOFT }}
          >
            {t.nextStep}
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <label className="text-xs font-bold" style={{ color: INK_SOFT }}>{t.albumNameLabel}</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t.newAlbumPlaceholder}
              className="px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: CARD_BORDER, background: INPUT_BG, color: INK }}
            />
          </div>

          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <label className="text-xs font-bold" style={{ color: INK_SOFT }}>{t.linkEventLabel}</label>
            <button
              onClick={() => setShowEventPicker(true)}
              className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm"
              style={{ border: CARD_BORDER, background: INPUT_BG, color: INK }}
            >
              <span className="truncate">{eventId ? linkedEventTitle : t.noLinkEvent}</span>
              <ChevronRight size={16} style={{ color: INK_SOFT, flexShrink: 0 }} />
            </button>
          </div>

          <div className="flex-1" />
          <button onClick={finishCreate} className="w-full py-3 rounded-xl font-bold text-sm flex-shrink-0" style={{ background: ACCENT, color: '#fff' }}>
            {t.createAlbum}
          </button>
        </div>
      )}

      {showEventPicker && (
        <EventLinkPicker
          events={events}
          currentEventId={eventId}
          t={t}
          onClose={() => setShowEventPicker(false)}
          onSelectNone={() => { setEventId(null); setShowEventPicker(false); }}
          onSelectEvent={id => { setEventId(id); setShowEventPicker(false); }}
          onCreateNew={() => { setShowEventPicker(false); setShowQuickEvent(true); }}
        />
      )}
      {showQuickEvent && (
        <QuickCreateEventSheet
          t={t}
          setEvents={setEvents}
          onCancel={() => setShowQuickEvent(false)}
          onCreated={id => { setEventId(id); setShowQuickEvent(false); }}
        />
      )}
    </div>
  );
}

export function EventLinkPicker({ events, currentEventId, t, onClose, onSelectNone, onSelectEvent, onCreateNew }) {
  useModalBackClose(true, onClose);
  const sorted = events.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  return createPortal(
    <div
      className="fixed inset-0 flex items-end md:items-center md:justify-center"
      style={{ zIndex: 260, background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-sm max-h-[75vh] rounded-t-3xl md:rounded-2xl p-5 flex flex-col gap-3"
        style={{ ...AUTH_GLASS }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between flex-shrink-0">
          <h2 className="text-base font-black" style={{ color: INK }}>{t.linkEventLabel}</h2>
          <button onClick={onClose} aria-label={t.close} style={{ color: INK_SOFT }}><X size={18} /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1">
          <button
            onClick={onSelectNone}
            className="text-left px-3 py-3 rounded-xl text-sm font-bold"
            style={{ background: !currentEventId ? 'var(--card-border)' : 'transparent', color: INK }}
          >
            {t.noLinkEvent}
          </button>
          <button onClick={onCreateNew} className="text-left px-3 py-3 rounded-xl text-sm font-bold flex items-center gap-1.5" style={{ color: ACCENT }}>
            <Plus size={14} /> {t.linkOptionNew}
          </button>
          {sorted.length > 0 && <p className="text-[11px] font-bold px-3 pt-1" style={{ color: INK_SOFT }}>{t.eventPickerTitle}</p>}
          {sorted.map(ev => (
            <button
              key={ev.id}
              onClick={() => onSelectEvent(ev.id)}
              className="text-left px-3 py-2.5 rounded-xl text-sm flex items-center justify-between gap-2"
              style={{ background: currentEventId === ev.id ? 'var(--card-border)' : 'transparent', color: INK }}
            >
              <span className="flex items-center gap-2 min-w-0"><span className="flex-shrink-0">{ev.icon}</span><span className="truncate">{ev.title}</span></span>
              <span className="text-xs flex-shrink-0" style={{ color: INK_SOFT }}>{(ev.date || '').replace(/-/g, '.')}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function QuickCreateEventSheet({ t, setEvents, onCancel, onCreated }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  useModalBackClose(true, onCancel);

  function submit() {
    if (!title.trim() || !date) return;
    const id = Date.now().toString();
    setEvents(prev => [...prev, {
      id, title: title.trim(), date, time: '', icon: ICONS[0], colorId: COLOR_TAGS[0].id,
      calendar: 'gregory', repeat: false, repeatUnit: 'year', repeatInterval: 1,
      isBirthday: false, isCare: false, careCustomIcon: null, mode: 'regular',
    }]);
    onCreated(id);
  }

  return createPortal(
    <div className="fixed inset-0 flex items-end md:items-center md:justify-center px-0 md:px-6" style={{ zIndex: 270, background: 'rgba(0,0,0,0.4)' }} onClick={onCancel}>
      <div
        className="w-full md:max-w-sm rounded-t-3xl md:rounded-2xl p-5 flex flex-col gap-3"
        style={{ ...AUTH_GLASS }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black" style={{ color: INK }}>{t.quickEventTitle}</h2>
          <button onClick={onCancel} aria-label={t.close} style={{ color: INK_SOFT }}><X size={18} /></button>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold" style={{ color: INK_SOFT }}>{t.titleLabel}</label>
          <input
            autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder={t.titlePlaceholder}
            className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: CARD_BORDER, background: INPUT_BG, color: INK }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold" style={{ color: INK_SOFT }}>{t.dateLabel}</label>
          <input
            type="date" value={date} onChange={e => setDate(e.target.value)}
            className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: CARD_BORDER, background: INPUT_BG, color: INK }}
          />
        </div>
        <button
          onClick={submit}
          disabled={!title.trim() || !date}
          className="w-full py-2.5 rounded-xl font-bold text-sm mt-1"
          style={{ background: title.trim() && date ? ACCENT : 'var(--card-border)', color: title.trim() && date ? '#fff' : INK_SOFT }}
        >
          {t.createAlbum}
        </button>
      </div>
    </div>,
    document.body
  );
}

export function AlbumDetailScreen({ album, events, setEvents, setAlbums, t, isLargeScreen, onBack, onViewEvent }) {
  const [photos, setPhotos] = useState(null); // null = 尚未讀取完成
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [photoSelectMode, setPhotoSelectMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showDeletePhotosConfirm, setShowDeletePhotosConfirm] = useState(false);
  const [showDeleteAlbumConfirm, setShowDeleteAlbumConfirm] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [showQuickEvent, setShowQuickEvent] = useState(false);
  const dragPhotoIdRef = useRef(null);
  const albumId = album && album.id;

  useEffect(() => {
    let cancelled = false;
    setPhotos(null);
    if (!albumId) return;
    (async () => {
      const list = await loadAlbumPhotosGlobal(albumId);
      if (!cancelled) setPhotos(list);
    })();
    return () => { cancelled = true; };
  }, [albumId]);

  useModalBackClose(lightboxIndex !== null, () => setLightboxIndex(null));

  async function persist(next) {
    setPhotos(next);
    if (!albumId) return;
    try { await persistAlbumPhotosGlobal(albumId, next); setError(''); }
    catch (err) { setError(t.albumPhotoUploadError); }
  }

  function handleAddPhotoClick() { fileInputRef.current && fileInputRef.current.click(); }
  async function handleFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length || !albumId) return;
    setUploading(true);
    setError('');
    try {
      const newPhotos = [];
      for (const file of files) {
        try {
          const dataUrl = await resizeImageFile(file);
          newPhotos.push({ id: `ph_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, dataUrl });
        } catch (err) {
          setError(t.albumPhotoUploadError);
        }
      }
      if (newPhotos.length) persist([...(photos || []), ...newPhotos]);
    } finally {
      setUploading(false);
    }
  }

  function handlePhotoLongPress(id) { setPhotoSelectMode(true); setSelectedPhotoIds(prev => (prev.includes(id) ? prev : [...prev, id])); }
  function handlePhotoTap(id, idx) {
    if (photoSelectMode) { setSelectedPhotoIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])); return; }
    setLightboxIndex(idx);
  }
  function cancelPhotoSelect() { setPhotoSelectMode(false); setSelectedPhotoIds([]); }
  function performDeleteSelectedPhotos() {
    setShowDeletePhotosConfirm(false);
    persist((photos || []).filter(p => !selectedPhotoIds.includes(p.id)));
    cancelPhotoSelect();
  }
  function handlePhotoDragStart(id) { dragPhotoIdRef.current = id; }
  function handlePhotoDragOver(e, overId) {
    e.preventDefault();
    const dragId = dragPhotoIdRef.current;
    if (!dragId || dragId === overId) return;
    setPhotos(current => {
      const list = current || [];
      const fromIdx = list.findIndex(p => p.id === dragId);
      const toIdx = list.findIndex(p => p.id === overId);
      if (fromIdx === -1 || toIdx === -1) return current;
      const next = [...list];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }
  function handlePhotoDragEnd() { dragPhotoIdRef.current = null; if (albumId && photos) persistAlbumPhotosGlobal(albumId, photos).catch(() => {}); }

  function startRename() { setRenameDraft(album.name); setRenaming(true); setShowMoreMenu(false); }
  function commitRename() {
    const name = renameDraft.trim();
    if (name) setAlbums(prev => prev.map(a => (a.id === albumId ? { ...a, name } : a)));
    setRenaming(false);
  }
  function requestDeleteAlbum() { setShowMoreMenu(false); setShowDeleteAlbumConfirm(true); }
  function performDeleteAlbum() {
    setShowDeleteAlbumConfirm(false);
    setAlbums(prev => prev.filter(a => a.id !== albumId));
    deleteAlbumPhotosGlobal(albumId);
    // 保險：如果這個相冊是從舊版「事件內嵌 albums」搬遷過來的，事件物件裡可能還留著同一個 id
    // 的骨架殘影（搬遷過程刻意保留、沒有清除，見 resolveAlbumsField 的說明）。這裡刪除相冊時
    // 順手把各事件 albums 欄位裡同 id 的殘影一併清掉，避免下次重新整理／雲端同步時，
    // deriveAlbumsFromEvents 又把已經刪除的相冊「復活」回來。
    setEvents(prev => prev.map(e => (
      Array.isArray(e.albums) && e.albums.some(a => a && a.id === albumId)
        ? { ...e, albums: e.albums.filter(a => !a || a.id !== albumId) }
        : e
    )));
    onBack();
  }
  function applyLinkEvent(nextEventId) {
    setAlbums(prev => prev.map(a => (a.id === albumId ? { ...a, eventId: nextEventId } : a)));
    setShowEventPicker(false);
  }

  if (!album) return null;
  const linkedEvent = album.eventId ? events.find(e => e.id === album.eventId) : null;
  const list = photos || [];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <div className="flex items-center justify-between flex-shrink-0 gap-2 min-h-[32px]">
        {renaming ? (
          <>
            <input
              autoFocus value={renameDraft} onChange={e => setRenameDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(false); }}
              className="flex-1 min-w-0 px-3 py-1.5 rounded-lg text-sm outline-none" style={{ border: CARD_BORDER, background: INPUT_BG, color: INK }}
            />
            <button onClick={commitRename} aria-label={t.confirmRename} style={{ color: MINT }}><Check size={18} /></button>
            <button onClick={() => setRenaming(false)} aria-label={t.cancel} style={{ color: INK_SOFT }}><X size={18} /></button>
          </>
        ) : photoSelectMode ? (
          <>
            <span className="text-sm font-medium truncate" style={{ color: INK_SOFT }}>{t.selectedCount(selectedPhotoIds.length)}</span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={cancelPhotoSelect} className="text-sm px-2 py-1 rounded-lg" style={{ color: INK_SOFT }}>{t.cancel}</button>
              <button
                onClick={() => setShowDeletePhotosConfirm(true)}
                disabled={!selectedPhotoIds.length}
                className="flex items-center gap-1 text-sm px-3 py-1 rounded-lg font-medium"
                style={{ background: DANGER, color: '#fff', opacity: selectedPhotoIds.length ? 1 : 0.4 }}
              >
                <Trash2 size={13} /> {t.delete}
              </button>
            </div>
          </>
        ) : (
          <>
            <button onClick={onBack} aria-label={t.back} style={{ color: INK, flexShrink: 0 }}><ChevronLeft size={22} /></button>
            <div className="flex-1 min-w-0 flex flex-col items-center">
              <h2 className="text-sm font-black truncate max-w-full" style={{ color: INK }}>{album.name}</h2>
              {linkedEvent && (
                <button onClick={() => onViewEvent && onViewEvent(linkedEvent.id)} className="text-[11px] truncate max-w-full" style={{ color: ACCENT }}>
                  {t.linkedEventBadge(linkedEvent.title)}
                </button>
              )}
            </div>
            <div className="relative flex-shrink-0">
              <button onClick={() => setShowMoreMenu(v => !v)} aria-label={t.moreActions} title={t.moreActions} style={{ color: INK }}><Settings size={18} /></button>
              {showMoreMenu && (
                <div className="absolute right-0 mt-1 rounded-xl overflow-hidden z-10" style={{ ...glass(), minWidth: 168, boxShadow: '0 10px 30px rgba(35,39,51,0.15)' }}>
                  <button onClick={startRename} className="w-full text-left px-3 py-2.5 text-sm" style={{ color: INK }}>{t.renameAlbum}</button>
                  <button onClick={() => { setShowMoreMenu(false); setShowEventPicker(true); }} className="w-full text-left px-3 py-2.5 text-sm" style={{ color: INK }}>{t.linkEventLabel}</button>
                  <button onClick={requestDeleteAlbum} className="w-full text-left px-3 py-2.5 text-sm" style={{ color: DANGER }}>{t.deleteAlbum}</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between flex-shrink-0">
        <p className="text-xs" style={{ color: INK_SOFT }}>{t.albumPhotoCount(list.length)}</p>
      </div>
      {error && <p className="text-xs flex-shrink-0" style={{ color: DANGER }}>{error}</p>}

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="grid grid-cols-3 gap-1.5">
          {!photoSelectMode && (
            <button
              onClick={handleAddPhotoClick}
              disabled={uploading}
              aria-label={t.addPhoto}
              title={t.addPhoto}
              className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1"
              style={{ border: '1.5px dashed var(--card-border)', color: INK_SOFT, background: 'transparent' }}
            >
              <Plus size={18} />
              <span className="text-[10px] font-bold">{t.newPhotoLabel}</span>
            </button>
          )}
          {list.map((p, idx) => (
            <PhotoThumb
              key={p.id}
              photo={p}
              selected={selectedPhotoIds.includes(p.id)}
              selectMode={photoSelectMode}
              draggable={!photoSelectMode}
              onTap={() => handlePhotoTap(p.id, idx)}
              onLongPress={() => handlePhotoLongPress(p.id)}
              onDragStartPhoto={() => handlePhotoDragStart(p.id)}
              onDragOverPhoto={e => handlePhotoDragOver(e, p.id)}
              onDragEndPhoto={handlePhotoDragEnd}
            />
          ))}
        </div>
        {photos !== null && !list.length && <p className="text-xs text-center mt-4" style={{ color: INK_SOFT }}>{t.noPhotosYet}</p>}
        {list.length > 0 && <p className="text-[11px] text-center mt-4 opacity-70" style={{ color: INK_SOFT }}>{t.albumBackupReminder}</p>}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFilesSelected} />

      {lightboxIndex !== null && list[lightboxIndex] && createPortal(
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 260, background: 'rgba(0,0,0,0.85)' }} onClick={() => setLightboxIndex(null)}>
          <button onClick={e => { e.stopPropagation(); setLightboxIndex(null); }} aria-label={t.close} className="absolute top-4 right-4" style={{ color: '#fff' }}><X size={26} /></button>
          {list.length > 1 && (
            <button onClick={e => { e.stopPropagation(); setLightboxIndex(i => (i - 1 + list.length) % list.length); }} className="absolute left-2 md:left-6 p-2" style={{ color: '#fff' }}>
              <ChevronLeft size={30} />
            </button>
          )}
          <img src={list[lightboxIndex].dataUrl} alt="" className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg" onClick={e => e.stopPropagation()} />
          {list.length > 1 && (
            <button onClick={e => { e.stopPropagation(); setLightboxIndex(i => (i + 1) % list.length); }} className="absolute right-2 md:right-6 p-2" style={{ color: '#fff' }}>
              <ChevronRight size={30} />
            </button>
          )}
        </div>,
        document.body
      )}

      {showDeletePhotosConfirm && createPortal(
        <ConfirmSheet
          isLargeScreen={isLargeScreen} t={t}
          title={t.deleteSelectedPhotosConfirmTitle} desc={t.deleteSelectedPhotosConfirmDesc(selectedPhotoIds.length)}
          onCancel={() => setShowDeletePhotosConfirm(false)} onConfirm={performDeleteSelectedPhotos}
        />,
        document.body
      )}
      {showDeleteAlbumConfirm && createPortal(
        <ConfirmSheet
          isLargeScreen={isLargeScreen} t={t}
          title={t.deleteSelectedAlbumsConfirmTitle} desc={t.deleteSelectedAlbumsConfirmDesc(1)}
          onCancel={() => setShowDeleteAlbumConfirm(false)} onConfirm={performDeleteAlbum}
        />,
        document.body
      )}
      {showEventPicker && (
        <EventLinkPicker
          events={events}
          currentEventId={album.eventId}
          t={t}
          onClose={() => setShowEventPicker(false)}
          onSelectNone={() => applyLinkEvent(null)}
          onSelectEvent={id => applyLinkEvent(id)}
          onCreateNew={() => { setShowEventPicker(false); setShowQuickEvent(true); }}
        />
      )}
      {showQuickEvent && (
        <QuickCreateEventSheet
          t={t}
          setEvents={setEvents}
          onCancel={() => setShowQuickEvent(false)}
          onCreated={id => { applyLinkEvent(id); setShowQuickEvent(false); }}
        />
      )}
    </div>
  );
}
