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
const LUNAR_MONTHS = [
  '正月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '冬月',
  '臘月',
];

const GANZHI_STEMS = [
  '甲', '乙', '丙', '丁', '戊',
  '己', '庚', '辛', '壬', '癸',
];

const GANZHI_BRANCHES = [
  '子', '丑', '寅', '卯', '辰', '巳',
  '午', '未', '申', '酉', '戌', '亥',
];

const CAL_EPOCH_GUESS = {
  islamic: y => Math.floor(622 + ((y - 1) * 354.36667) / 365.2425),
  hebrew: y => y - 3760,
};

const JP_ERAS = [
  { id: 'meiji', label: '明治', startYear: 1868 },
  { id: 'taisho', label: '大正', startYear: 1912 },
  { id: 'showa', label: '昭和', startYear: 1926 },
  { id: 'heisei', label: '平成', startYear: 1989 },
  { id: 'reiwa', label: '令和', startYear: 2019 },
];

export function combineDateTime(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr || '00:00'}:00`);
}

export function addMonths(d, n) {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

export function addYears(d, n) {
  const r = new Date(d);
  r.setFullYear(r.getFullYear() + n);
  return r;
}

export function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

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

export function getCalendarParts(date, calendarId) {
  try {
    if (calendarId === 'chinese') {
      const dtf = new Intl.DateTimeFormat('en-US', {
        calendar: 'chinese',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      });

      const obj = {};
      dtf.formatToParts(date).forEach(
        p => (obj[p.type] = p.value)
      );

      if (obj.relatedYear && !obj.year) {
        obj.year = obj.relatedYear;
      }

      return obj;
    }

    const dtf = new Intl.DateTimeFormat(
      `zh-TW-u-ca-${calendarId}`,
      {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        era: 'short',
      }
    );

    const obj = {};
    dtf.formatToParts(date).forEach(
      p => (obj[p.type] = p.value)
    );

    return obj;
  } catch (e) {
    return null;
  }
}

export function getGanZhi(relatedYear) {
  const stemIdx =
    (((relatedYear - 4) % 10) + 10) % 10;

  const branchIdx =
    (((relatedYear - 4) % 12) + 12) % 12;

  return (
    GANZHI_STEMS[stemIdx] +
    GANZHI_BRANCHES[branchIdx]
  );
}

export function chineseDayName(day) {
  const num = [
    '',
    '一',
    '二',
    '三',
    '四',
    '五',
    '六',
    '七',
    '八',
    '九',
    '十',
  ];

  if (day === 10) return '初十';
  if (day === 20) return '二十';
  if (day === 30) return '三十';
  if (day < 10) return '初' + num[day];
  if (day < 20) return '十' + num[day - 10];

  return '廿' + num[day - 20];
}

export function parseChineseNumericMonth(monthStr) {
  const isLeap = /bis$/i.test(monthStr);
  const num = parseInt(monthStr, 10);

  return {
    num: Number.isNaN(num) ? null : num,
    isLeap,
  };
}

export function chineseMonthLabel(monthNum, isLeap) {
  const base =
    LUNAR_MONTHS[monthNum - 1] ||
    `${monthNum}月`;

  return isLeap ? `閏${base}` : base;
}

export function chineseMonthLabelToNumeric(label) {
  const isLeap = label.startsWith('閏');
  const bare = isLeap ? label.slice(1) : label;
  const idx = LUNAR_MONTHS.indexOf(bare);

  return {
    num: idx === -1 ? null : idx + 1,
    isLeap,
  };
}

export function chineseMonthInfo(date) {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      calendar: 'chinese',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });

    const o = {};
    dtf.formatToParts(date).forEach(
      p => (o[p.type] = p.value)
    );

    const { num, isLeap } =
      parseChineseNumericMonth(o.month || '');

    if (num == null) return null;

    return {
      year: parseInt(o.relatedYear || o.year),
      month: chineseMonthLabel(num, isLeap),
      day: parseInt(o.day),
    };
  } catch (e) {
    return null;
  }
}

export function buildChineseYearMonths(lunarYear) {
  let d = new Date(lunarYear - 1, 10, 1);
  const months = [];
  let started = false;

  for (let i = 0; i < 480; i++) {
    const info = chineseMonthInfo(d);

    if (info && info.year === lunarYear) {
      started = true;

      const last = months[months.length - 1];

      if (!last || last.label !== info.month) {
        months.push({
          label: info.month,
          start: new Date(d),
          days: 1,
        });
      } else {
        last.days += 1;
      }
    } else if (started) {
      break;
    }

    d = addDays(d, 1);
  }

  return months;
}

export function chineseCalendarToGregorian(
  lunarYear,
  monthLabel,
  day
) {
  const months =
    buildChineseYearMonths(lunarYear);

  const m = months.find(
    x => x.label === monthLabel
  );

  if (!m) return null;

  return addDays(
    m.start,
    Math.min(Math.max(day, 1), m.days) - 1
  );
}

export function calendarDateToGregorian(
  calendarId,
  year,
  month,
  day
) {
  if (calendarId === 'buddhist') {
    return new Date(
      year - 543,
      month - 1,
      day
    );
  }

  if (calendarId === 'japanese') {
    return new Date(year, month - 1, day);
  }

  if (calendarId === 'chinese') {
    return null;
  }

  const guessFn =
    CAL_EPOCH_GUESS[calendarId];

  if (!guessFn) return null;

  let d = new Date(
    guessFn(year),
    0,
    1
  );

  d = addDays(d, -60);

  for (let i = 0; i < 800; i++) {
    const p = calNumericParts(
      d,
      calendarId
    );

    if (
      p &&
      p.year === year &&
      p.month === month &&
      p.day === day
    ) {
      return d;
    }

    d = addDays(d, 1);
  }

  return null;
}

export function getCalendarMonthCount(
  calendarId,
  year
) {
  if (calendarId === 'hebrew') {
    return calendarDateToGregorian(
      'hebrew',
      year,
      13,
      1
    )
      ? 13
      : 12;
  }

  return 12;
}

export function getCalendarMonthDays(
  calendarId,
  year,
  month
) {
  if (
    calendarId === 'buddhist' ||
    calendarId === 'japanese'
  ) {
    const gYear =
      calendarId === 'buddhist'
        ? year - 543
        : year;

    return new Date(
      gYear,
      month,
      0
    ).getDate();
  }

  const start = calendarDateToGregorian(
    calendarId,
    year,
    month,
    1
  );

  if (!start) return 30;

  for (let len = 25; len <= 31; len++) {
    const p = calNumericParts(
      addDays(start, len),
      calendarId
    );

    if (
      !p ||
      p.month !== month ||
      p.year !== year
    ) {
      return len;
    }
  }

  return 30;
}

export function japaneseEraToGregorianYear(
  eraId,
  year
) {
  const e =
    JP_ERAS.find(x => x.id === eraId) ||
    JP_ERAS[JP_ERAS.length - 1];

  return e.startYear + year - 1;
}

export function getJapaneseEra(date) {
  try {
    const dtf = new Intl.DateTimeFormat(
      'zh-TW-u-ca-japanese',
      {
        year: 'numeric',
        era: 'short',
      }
    );

    const o = {};
    dtf.formatToParts(date).forEach(
      p => (o[p.type] = p.value)
    );

    const found =
      JP_ERAS.find(
        x => x.label === o.era
      ) ||
      JP_ERAS[JP_ERAS.length - 1];

    return {
      id: found.id,
      year: parseInt(o.year) || 1,
    };
  } catch (e) {
    return {
      id: 'reiwa',
      year: 1,
    };
  }
}

export function japaneseEraYearMax(eraId) {
  const idx =
    JP_ERAS.findIndex(
      e => e.id === eraId
    );

  if (idx === -1) return 60;

  if (idx === JP_ERAS.length - 1) {
    return (
      new Date().getFullYear() -
      JP_ERAS[idx].startYear +
      15
    );
  }

  return (
    JP_ERAS[idx + 1].startYear -
    JP_ERAS[idx].startYear +
    1
  );
}

export function formatAltCalendar(
  date,
  calendarId,
  lang,
  t,
  CAL_OPTIONS
) {
  if (
    !calendarId ||
    calendarId === 'gregory'
  ) {
    return '';
  }

  if (calendarId === 'chinese') {
    const info = chineseMonthInfo(date);

    if (!info) return '';

    const ganzhi = getGanZhi(info.year);

    if (lang === 'zh-TW') {
      return `${t.lunarPrefix}${ganzhi}年・${info.month}${chineseDayName(info.day)}`;
    }

    const {
      num,
      isLeap,
    } = chineseMonthLabelToNumeric(
      info.month
    );

    const leapMark = {
      ja: '閏',
      ko: '윤',
    }[lang] || 'leap ';

    const prefix = isLeap
      ? leapMark
      : '';

    if (lang === 'ja') {
      return `${t.lunarPrefix}${ganzhi}年 ${prefix}${num}/${info.day}`;
    }

    if (lang === 'ko') {
      return `${t.lunarPrefix} ${ganzhi}년 ${prefix}${num}/${info.day}`;
    }

    return `${t.lunarPrefix} ${ganzhi} Year ${prefix}${num}/${info.day}`;
  }

  const parts = getCalendarParts(
    date,
    calendarId
  );

  if (!parts) return '';

  const m = parseInt(parts.month);
  const d = parseInt(parts.day);

  const calLabel =
    (
      CAL_OPTIONS.find(
        c => c.id === calendarId
      ) || {}
    ).label || {};

  return `${calLabel[lang] || calendarId} ${parts.year}/${m}/${d}`;
}
export function getChineseDateInfo(date) {
  const parts = getCalendarParts(date, 'chinese');

  if (!parts) return null;

  const { num, isLeap } = parseChineseNumericMonth(
    parts.month || ''
  );

  if (num == null) return null;

  return {
    year: parseInt(parts.relatedYear || parts.year),
    month: num,
    isLeap,
    day: parseInt(parts.day),
  };
}
export function isoDateStr(d) {
  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}
