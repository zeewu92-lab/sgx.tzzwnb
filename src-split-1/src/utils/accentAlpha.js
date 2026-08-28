import { ACCENT } from '../constants/colors.js';

export function accentAlpha(hexAlpha) {
  const pct = (parseInt(hexAlpha, 16) / 255) * 100;
  return `color-mix(in srgb, ${ACCENT} ${pct.toFixed(1)}%, transparent)`;
}
