export type TremorChartDatum = Record<string, string | number | undefined>;

export function formatChartMoney(value: number) {
  return `\u20B1${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatChartAxisMoney(value: number) {
  return `\u20B1${value.toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function getChartSeriesColor(index: number) {
  const palette = ["#22c55e", "#f59e0b", "#818cf8", "#ef4444"] as const;
  return palette[index % palette.length];
}
