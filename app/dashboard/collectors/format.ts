export function formatCollectorsCurrency(value: number) {
  return `\u20B1${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCollectorsAxisCurrency(value: number) {
  if (Math.abs(value) >= 1_000_000) {
    return `\u20B1${(value / 1_000_000).toFixed(1)}M`;
  }

  if (Math.abs(value) >= 1_000) {
    return `\u20B1${(value / 1_000).toFixed(0)}k`;
  }

  return `\u20B1${value.toLocaleString("en-PH", {
    maximumFractionDigits: 0,
  })}`;
}

export function formatCollectorsInteger(value: number) {
  return value.toLocaleString("en-PH");
}

export function formatCollectorsPercent(value: number) {
  return `${value.toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}%`;
}

export function formatCollectorsNullablePercent(value: number | null, fallback = "N/A") {
  if (value === null) {
    return fallback;
  }

  return formatCollectorsPercent(value);
}

export function formatCollectorsAxisPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function formatCollectorsSignedPercent(value: number | null) {
  if (value === null) {
    return "New";
  }

  if (Math.abs(value) < 0.5) {
    return "Flat";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}%`;
}

export function collectorsTrendTone(value: number | null) {
  if (value === null) {
    return "text-sky-600";
  }

  if (value > 0.5) {
    return "text-emerald-600";
  }

  if (value < -0.5) {
    return "text-rose-600";
  }

  return "text-muted-foreground";
}
