export function calNumericParts(date, calendarId) {
  try {
    const dtf = new Intl.DateTimeFormat(
      'zh-TW-u-ca-' + calendarId,
      {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      }
    );

    const o = {};
    dtf.formatToParts(date).forEach(
      p => (o[p.type] = p.value)
    );

    return {
      year: parseInt(o.year),
      month: parseInt(o.month),
      day: parseInt(o.day),
    };
  } catch (e) {
    return null;
  }
}
