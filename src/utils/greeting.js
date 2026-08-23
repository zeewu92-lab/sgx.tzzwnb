export function getGreetingInfo(date, tz) {
  let hour;

  try {
    const zone =
      tz || Intl.DateTimeFormat().resolvedOptions().timeZone;

    hour = parseInt(
      new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        hour: 'numeric',
        hour12: false,
      }).format(date),
      10
    );
  } catch (err) {
    hour = date.getHours();
  }

  if (hour >= 5 && hour < 9) {
    return { key: 'greetMorning', emoji: '☀️' };
  }

  if (hour >= 9 && hour < 12) {
    return { key: 'greetForenoon', emoji: '🌤️' };
  }

  if (hour >= 12 && hour < 14) {
    return { key: 'greetAfternoon', emoji: '🌤️' };
  }

  if (hour >= 14 && hour < 18) {
    return { key: 'greetLateAfternoon', emoji: '🌇' };
  }

  return { key: 'greetEvening', emoji: '🌙' };
}
