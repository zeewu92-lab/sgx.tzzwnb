import { useRef } from 'react';
import { Check } from 'lucide-react';
import { DANGER } from '../../constants/colors.js';

export function PhotoThumb({ photo, selected, selectMode, draggable, onTap, onLongPress, onDragStartPhoto, onDragOverPhoto, onDragEndPhoto }) {
  const timerRef = useRef(null);
  const firedRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const LONG_PRESS_MOVE_THRESHOLD = 10;

  const start = e => {
    firedRef.current = false;
    const point = e.touches ? e.touches[0] : e;
    startPosRef.current = { x: point.clientX, y: point.clientY };
    timerRef.current = setTimeout(() => { firedRef.current = true; onLongPress(); }, 500);
  };
  const clear = () => { if (timerRef.current) clearTimeout(timerRef.current); timerRef.current = null; };
  const move = e => {
    if (!timerRef.current) return;
    const point = e.touches ? e.touches[0] : e;
    const dx = point.clientX - startPosRef.current.x;
    const dy = point.clientY - startPosRef.current.y;
    if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_THRESHOLD) clear();
  };
  const handleClick = () => {
    if (firedRef.current) { firedRef.current = false; return; }
    onTap();
  };

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStartPhoto}
      onDragOver={onDragOverPhoto}
      onDrop={e => e.preventDefault()}
      onDragEnd={onDragEndPhoto}
      onMouseDown={start} onMouseUp={clear} onMouseLeave={clear} onMouseMove={move}
      onTouchStart={start} onTouchEnd={clear} onTouchMove={move}
      onClick={handleClick}
      className="relative aspect-square rounded-xl overflow-hidden"
      style={{ cursor: draggable ? 'grab' : 'pointer', userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      <img src={photo.dataUrl || photo.url} alt="" className="w-full h-full object-cover" draggable={false} />
      {selectMode && (
        <span
          className="absolute flex items-center justify-center rounded"
          style={{ width: 18, height: 18, top: 5, left: 5, border: `1px solid ${selected ? DANGER : '#fff'}`, background: selected ? DANGER : 'rgba(0,0,0,0.35)' }}
        >
          {selected && <Check size={11} color="#fff" />}
        </span>
      )}
    </div>
  );
}
