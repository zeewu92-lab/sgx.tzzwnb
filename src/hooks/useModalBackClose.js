import { useEffect, useRef } from 'react';

export const __modalBackStack = [];

export let __pendingProgrammaticBacks = 0;

export function useModalBackClose(active, onRequestClose) {
  const closeRef = useRef(onRequestClose);
  closeRef.current = onRequestClose;
  useEffect(() => {
    if (!active || typeof window === 'undefined') return;
    const entry = {};
    __modalBackStack.push(entry);
    window.history.pushState({ __modal: true }, '');
    let consumed = false;
    const isTop = () => __modalBackStack[__modalBackStack.length - 1] === entry;
    function handlePopState() {
      if (__pendingProgrammaticBacks > 0) { __pendingProgrammaticBacks--; return; }
      consumed = true;
      if (isTop()) closeRef.current();
    }
    function handleKeyDown(e) {
      if ((e.key !== 'Escape' && e.key !== 'Esc') || !isTop()) return;
      e.preventDefault();
      closeRef.current();
      if (!consumed) {
        consumed = true;
        __pendingProgrammaticBacks++;
        window.history.back();
      }
    }
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
      const idx = __modalBackStack.indexOf(entry);
      if (idx !== -1) __modalBackStack.splice(idx, 1);
      if (!consumed) {
        consumed = true;
        __pendingProgrammaticBacks++;
        window.history.back();
      }
    };
  }, [active]);
}
