export const tremorPalette = [
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#ef4444", // red
] as const;

export function getTremorSeriesColor(index: number) {
  return tremorPalette[index % tremorPalette.length];
}

export function formatTremorMoney(value: number) {
  return value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
