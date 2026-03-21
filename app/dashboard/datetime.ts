const MANILA_TIME_ZONE = "Asia/Manila";

function parseStoredTimestamp(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsedDateOnly = new Date(`${trimmed}T00:00:00Z`);
    return Number.isNaN(parsedDateOnly.getTime()) ? null : parsedDateOnly;
  }

  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const withZone = /(?:Z|[+-]\d{2}:\d{2})$/.test(normalized) ? normalized : `${normalized}Z`;
  const parsed = new Date(withZone);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatStoredDateForManila(
  value: string | null | undefined,
  options?: Omit<Intl.DateTimeFormatOptions, "timeZone">,
) {
  if (!value) {
    return "N/A";
  }

  const parsed = parseStoredTimestamp(value);
  if (!parsed) {
    return value;
  }

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...options,
    timeZone: MANILA_TIME_ZONE,
  }).format(parsed);
}

export function formatStoredDateTimeForManila(
  value: string | null | undefined,
  options?: Omit<Intl.DateTimeFormatOptions, "timeZone">,
) {
  if (!value) {
    return "N/A";
  }

  const parsed = parseStoredTimestamp(value);
  if (!parsed) {
    return value;
  }

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...options,
    timeZone: MANILA_TIME_ZONE,
  }).format(parsed);
}
