import { X } from 'lucide-react';
import { AUTH_GLASS, DANGER, INK, INK_SOFT } from '../../constants/colors.js';

export function ConfirmSheet({ isLargeScreen, title, desc, t, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center px-6" style={{ zIndex: 270, background: 'rgba(0,0,0,0.4)' }} onClick={onCancel}>
      <div className={`w-full ${isLargeScreen ? 'max-w-sm' : 'max-w-xs'} p-6 rounded-2xl flex flex-col gap-3`} style={{ ...AUTH_GLASS }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black" style={{ color: DANGER }}>{title}</h2>
          <button onClick={onCancel} aria-label={t.close} style={{ color: INK_SOFT }}><X size={18} /></button>
        </div>
        <p className="text-sm" style={{ color: INK }}>{desc}</p>
        <div className="flex items-center gap-2.5">
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ background: 'rgba(255,255,255,0.7)', border: `1px solid ${DANGER}`, color: DANGER }}>
            {t.confirmDeleteLandmark}
          </button>
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ background: DANGER, color: '#fff' }}>
            {t.cancelDeleteLandmark}
          </button>
        </div>
      </div>
    </div>
  );
}
