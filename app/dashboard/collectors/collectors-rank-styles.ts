export function collectorRankBadgeClassName(rank: number) {
  if (rank === 1) {
    return "border-[#e6c25b] bg-[#fbf0c1] text-[#7a5800]";
  }

  if (rank === 2) {
    return "border-slate-300 bg-slate-100 text-slate-700";
  }

  if (rank === 3) {
    return "border-orange-200 bg-orange-100 text-orange-800";
  }

  return "border-border bg-background text-foreground";
}

export function collectorRankCardClassName(rank: number) {
  if (rank === 1) {
    return "border-[#eed98c] bg-[#fff8dd]";
  }

  if (rank === 2) {
    return "border-slate-200 bg-slate-50";
  }

  if (rank === 3) {
    return "border-orange-200 bg-orange-50";
  }

  return "border-border bg-background/80";
}
