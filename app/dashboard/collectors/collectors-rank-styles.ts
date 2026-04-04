export function collectorRankBadgeClassName(rank: number) {
  if (rank === 1) {
    return "border-[#d9b44c] bg-linear-to-br from-[#fff7d8] via-[#f6dc8e] to-[#e2b34b] text-[#6f4c00] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(166,117,0,0.14)] dark:border-[#8d6f1f] dark:bg-linear-to-br dark:from-[#4e3c07] dark:via-[#6c5310] dark:to-[#8a6815] dark:text-[#fce8a3] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_2px_rgba(0,0,0,0.32)]";
  }

  if (rank === 2) {
    return "border-[#bcc5d2] bg-linear-to-br from-[#ffffff] via-[#edf2f8] to-[#cfd7e3] text-[#4d596a] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_1px_2px_rgba(93,108,126,0.12)] dark:border-[#6d7a8d] dark:bg-linear-to-br dark:from-[#2b323b] dark:via-[#3a4350] dark:to-[#566171] dark:text-[#eef4fb] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_2px_rgba(0,0,0,0.3)]";
  }

  if (rank === 3) {
    return "border-[#d59a6a] bg-linear-to-br from-[#fff1e6] via-[#e9bc93] to-[#c98356] text-[#7a4322] shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_1px_2px_rgba(133,77,36,0.14)] dark:border-[#8e5c39] dark:bg-linear-to-br dark:from-[#4a2712] dark:via-[#6a3a1e] dark:to-[#8a4c27] dark:text-[#ffd8bc] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_2px_rgba(0,0,0,0.3)]";
  }

  return "border-border bg-muted/60 text-foreground dark:border-white/12 dark:bg-white/8 dark:text-foreground";
}

export function collectorRankCardClassName(rank: number) {
  if (rank === 1) {
    return "border-[#ead38a] bg-linear-to-br from-[#fffdf4] via-[#fff5d4] to-[#f3df9f] shadow-[inset_0_1px_0_rgba(255,255,255,0.92),inset_0_-14px_28px_rgba(212,168,59,0.08)] dark:border-[#755d19] dark:bg-linear-to-br dark:from-[#2d2407] dark:via-[#3b300b] dark:to-[#4b3c10] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-16px_28px_rgba(212,168,59,0.12)]";
  }

  if (rank === 2) {
    return "border-[#d9e0ea] bg-linear-to-br from-[#fbfdff] via-[#f2f5f9] to-[#dfe5ee] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-14px_28px_rgba(149,163,184,0.07)] dark:border-[#586372] dark:bg-linear-to-br dark:from-[#1f252d] dark:via-[#2a313b] dark:to-[#343d49] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-16px_28px_rgba(149,163,184,0.08)]";
  }

  if (rank === 3) {
    return "border-[#e2b28d] bg-linear-to-br from-[#fff9f4] via-[#f7e1cd] to-[#e6be9c] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-14px_28px_rgba(179,110,60,0.08)] dark:border-[#8a5b3b] dark:bg-linear-to-br dark:from-[#2b1b11] dark:via-[#392318] dark:to-[#4a2f21] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-16px_28px_rgba(179,110,60,0.1)]";
  }

  return "border-border bg-background/80 dark:border-white/10 dark:bg-white/[0.03]";
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
    return "border border-[#efdca4]/80 bg-white/55 dark:border-[#917323]/70 dark:bg-black/14";
  }

  if (rank === 2) {
    return "border border-[#dce3ec]/80 bg-white/60 dark:border-[#6b7788]/70 dark:bg-black/12";
  }

  if (rank === 3) {
    return "border border-[#e7c3a5]/80 bg-white/55 dark:border-[#986544]/70 dark:bg-black/12";
  }

  return "border border-border/70 bg-muted/55 dark:border-white/10 dark:bg-white/[0.04]";
}
