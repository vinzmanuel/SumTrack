export function formatMoney(value: number) {
  return `\u20B1${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function todayInManila() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

export function firstDayOfMonth(dateString: string) {
  return `${dateString.slice(0, 7)}-01`;
}

export function formatDateShort(value: string) {
  const [year, month, day] = value.split("-");
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}
