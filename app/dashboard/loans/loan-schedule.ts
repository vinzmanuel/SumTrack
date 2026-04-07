const FIXED_TERM_OPTION_SET = new Set([58, 60]);

const FIXED_HOLIDAYS = new Set(["01-01", "11-02", "12-25"]);

function parseIsoDateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return { year, month, day };
}

function parseIsoDate(value: string) {
  const parts = parseIsoDateParts(value);
  if (!parts) {
    return null;
  }

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addUtcDays(value: Date, amount: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function calculateEasterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(Date.UTC(year, month - 1, day));
}

function calculateGoodFridayIsoDate(year: number) {
  return toIsoDate(addUtcDays(calculateEasterSunday(year), -2));
}

export function addCalendarDaysToIsoDate(dateString: string, days: number) {
  const date = parseIsoDate(dateString);
  if (!date || !Number.isFinite(days)) {
    return null;
  }

  return toIsoDate(addUtcDays(date, days));
}

export function calculateCalendarDayDiff(startDate: string, dueDate: string) {
  const start = parseIsoDate(startDate);
  const due = parseIsoDate(dueDate);
  if (!start || !due) {
    return null;
  }

  const diff = Math.round((due.getTime() - start.getTime()) / 86400000);
  return diff > 0 ? diff : null;
}

export function enumerateIsoDates(dateFrom: string, dateTo: string) {
  const start = parseIsoDate(dateFrom);
  const end = parseIsoDate(dateTo);

  if (!start || !end || end < start) {
    return [] as string[];
  }

  const dates: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    dates.push(toIsoDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

export function isNonCollectionHoliday(dateString: string) {
  const parts = parseIsoDateParts(dateString);
  if (!parts) {
    return false;
  }

  const monthDay = `${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  if (FIXED_HOLIDAYS.has(monthDay)) {
    return true;
  }

  return dateString === calculateGoodFridayIsoDate(parts.year);
}

export function isValidScheduledCollectionDate(dateString: string) {
  const date = parseIsoDate(dateString);
  if (!date) {
    return false;
  }

  if (date.getUTCDay() === 0) {
    return false;
  }

  return !isNonCollectionHoliday(dateString);
}

export function countScheduledCollectionDatesBetween(startDate: string, dueDate: string) {
  return enumerateIsoDates(startDate, dueDate).filter(isValidScheduledCollectionDate).length;
}

export function generateScheduledCollectionDates(params: {
  startDate: string;
  obligationCount: number;
}) {
  if (!Number.isFinite(params.obligationCount) || params.obligationCount <= 0) {
    return [] as string[];
  }

  const start = parseIsoDate(params.startDate);
  if (!start) {
    return [] as string[];
  }

  const dates: string[] = [];
  const cursor = new Date(start);

  while (dates.length < params.obligationCount) {
    const currentIsoDate = toIsoDate(cursor);
    if (isValidScheduledCollectionDate(currentIsoDate)) {
      dates.push(currentIsoDate);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

export function calculateScheduledDueDate(params: {
  startDate: string;
  obligationCount: number;
}) {
  const dates = generateScheduledCollectionDates(params);
  return dates.length > 0 ? dates[dates.length - 1] : null;
}

export function isFixedScheduledTermOption(termDays: number | null | undefined): termDays is number {
  return typeof termDays === "number" && FIXED_TERM_OPTION_SET.has(termDays);
}

export function usesScheduledCollectionModel(params: {
  startDate: string;
  dueDate: string;
  termDays: number | null | undefined;
}) {
  if (!isFixedScheduledTermOption(params.termDays)) {
    return false;
  }

  const obligationCount = params.termDays;

  return (
    calculateScheduledDueDate({
      startDate: params.startDate,
      obligationCount,
    }) === params.dueDate
  );
}

export function resolveLoanScheduleDates(params: {
  startDate: string;
  dueDate: string;
  termDays: number | null | undefined;
}) {
  if (
    usesScheduledCollectionModel({
      startDate: params.startDate,
      dueDate: params.dueDate,
      termDays: params.termDays,
    }) &&
    typeof params.termDays === "number"
  ) {
    return generateScheduledCollectionDates({
      startDate: params.startDate,
      obligationCount: params.termDays,
    });
  }

  return enumerateIsoDates(params.startDate, params.dueDate);
}

export function calculateLoanExpectedObligationCount(params: {
  startDate: string;
  dueDate: string;
  termDays: number | null | undefined;
}) {
  if (
    usesScheduledCollectionModel({
      startDate: params.startDate,
      dueDate: params.dueDate,
      termDays: params.termDays,
    }) &&
    typeof params.termDays === "number"
  ) {
    return params.termDays;
  }

  if (typeof params.termDays === "number" && Number.isFinite(params.termDays) && params.termDays > 0) {
    return params.termDays;
  }

  return enumerateIsoDates(params.startDate, params.dueDate).length;
}

export function countLoanExpectedObligationsInRange(params: {
  startDate: string;
  dueDate: string;
  termDays: number | null | undefined;
  rangeStart: string;
  rangeEnd: string;
}) {
  const overlapStart = params.startDate > params.rangeStart ? params.startDate : params.rangeStart;
  const overlapEnd = params.dueDate < params.rangeEnd ? params.dueDate : params.rangeEnd;

  if (overlapEnd < overlapStart) {
    return 0;
  }

  if (
    usesScheduledCollectionModel({
      startDate: params.startDate,
      dueDate: params.dueDate,
      termDays: params.termDays,
    })
  ) {
    return resolveLoanScheduleDates(params).filter(
      (date) => date >= overlapStart && date <= overlapEnd,
    ).length;
  }

  return enumerateIsoDates(overlapStart, overlapEnd).length;
}
