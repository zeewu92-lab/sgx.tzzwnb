export function getUtcOffset(tz, now) {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'longOffset',
    });

    const part = dtf
      .formatToParts(now)
      .find(p => p.type === 'timeZoneName');

    if (!part) return '';

    return part.value
      .replace('GMT', 'UTC')
      .replace(/UTC$/, 'UTC+00:00');
  } catch (e) {
    return '';
  }
}

export function getOffsetMinutes(tz, now) {
  const offsetStr = getUtcOffset(tz, now);

  const m = offsetStr.match(
    /UTC([+-])(\d{2}):(\d{2})/
  );

  if (!m) return 0;

  const sign =
    m[1] === '-' ? -1 : 1;

  return (
    sign *
    (
      parseInt(m[2], 10) * 60 +
      parseInt(m[3], 10)
    )
  );
}

export function formatOffsetDiff(diffMinutes) {
  const sign =
    diffMinutes > 0 ? '+' : '−';

  const abs =
    Math.abs(diffMinutes);

  const h =
    Math.floor(abs / 60);

  const mm =
    abs % 60;

  return `${sign}${h}${
    mm
      ? `:${String(mm).padStart(2, '0')}`
      : ''
  }`;
}
