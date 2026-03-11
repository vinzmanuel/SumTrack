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

export function formatCollectorsAxisPercent(value: number) {
  return `${Math.round(value)}%`;
}
