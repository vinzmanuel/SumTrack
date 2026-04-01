export function collectorRankBadgeClassName(rank: number) {
  if (rank === 1) {
    return "border-[#d9b44c] bg-linear-to-br from-[#fff7d8] via-[#f6dc8e] to-[#e2b34b] text-[#6f4c00] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(166,117,0,0.14)]";
  }

  if (rank === 2) {
    return "border-[#bcc5d2] bg-linear-to-br from-[#ffffff] via-[#edf2f8] to-[#cfd7e3] text-[#4d596a] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_1px_2px_rgba(93,108,126,0.12)]";
  }

  if (rank === 3) {
    return "border-[#d59a6a] bg-linear-to-br from-[#fff1e6] via-[#e9bc93] to-[#c98356] text-[#7a4322] shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_1px_2px_rgba(133,77,36,0.14)]";
  }

  return "border-border bg-background text-foreground";
}

export function collectorRankCardClassName(rank: number) {
  if (rank === 1) {
    return "border-[#ead38a] bg-linear-to-br from-[#fffdf4] via-[#fff5d4] to-[#f3df9f] shadow-[inset_0_1px_0_rgba(255,255,255,0.92),inset_0_-14px_28px_rgba(212,168,59,0.08)]";
  }

  if (rank === 2) {
    return "border-[#d9e0ea] bg-linear-to-br from-[#fbfdff] via-[#f2f5f9] to-[#dfe5ee] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-14px_28px_rgba(149,163,184,0.07)]";
  }

  if (rank === 3) {
    return "border-[#e2b28d] bg-linear-to-br from-[#fff9f4] via-[#f7e1cd] to-[#e6be9c] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-14px_28px_rgba(179,110,60,0.08)]";
  }

  return "border-border bg-background/80";
}

export function collectorRankEyebrowClassName(rank: number) {
  if (rank === 1) {
    return "text-[#8a6200]";
  }

  if (rank === 2) {
    return "text-[#667388]";
  }

  if (rank === 3) {
    return "text-[#93542d]";
  }

  return "text-muted-foreground";
}

export function collectorRankMetricClassName(rank: number) {
  if (rank === 1) {
    return "border border-[#efdca4]/80 bg-white/55";
  }

  if (rank === 2) {
    return "border border-[#dce3ec]/80 bg-white/60";
  }

  if (rank === 3) {
    return "border border-[#e7c3a5]/80 bg-white/55";
  }

  return "border border-border/70 bg-muted/55";
}
