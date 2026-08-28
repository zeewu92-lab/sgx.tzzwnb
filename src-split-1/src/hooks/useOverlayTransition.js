import { useState, useEffect } from 'react';

export const DROPDOWN_CLOSE_EVENT = 'app:dropdown-open';

export function openDropdownExclusive(id) {
  window.dispatchEvent(new CustomEvent(DROPDOWN_CLOSE_EVENT, { detail: id }));
}

export function useExclusiveDropdown(id, isOpen, close) {
  useEffect(() => {
    function handler(e) {
      if (e.detail !== id) close();
    }
    window.addEventListener(DROPDOWN_CLOSE_EVENT, handler);
    return () => window.removeEventListener(DROPDOWN_CLOSE_EVENT, handler);
  }, [id, close]);
}

export const LARGE_SCREEN_BREAKPOINT = 760;

export function useIsLargeScreen(breakpoint = LARGE_SCREEN_BREAKPOINT) {
  const [isLarge, setIsLarge] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= breakpoint : false));
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const handler = () => setIsLarge(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isLarge;
}

export function useOverlayTransition(active, duration = 180) {
  const [mounted, setMounted] = useState(active);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    let raf, timer;
    if (active) {
      setMounted(true);
      raf = requestAnimationFrame(() => setShown(true));
    } else {
      setShown(false);
      timer = setTimeout(() => setMounted(false), duration);
    }
    return () => { if (raf) cancelAnimationFrame(raf); if (timer) clearTimeout(timer); };
  }, [active, duration]);
  return [mounted, shown];
}
