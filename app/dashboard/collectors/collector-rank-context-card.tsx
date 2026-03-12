import { CollectorInfoHint } from "@/app/dashboard/collectors/collector-info-hint";
import { cn } from "@/lib/utils";

export function CollectorRankContextCard({
  branchName,
  branchRank,
  branchCollectorCount,
  nationwideRank,
  visibleCollectorCount,
  className,
  basisLabel = "Average monthly collections in the active view.",
}: {
  branchName: string;
  branchRank: number;
  branchCollectorCount: number;
  nationwideRank: number;
  visibleCollectorCount: number;
  className?: string;
  basisLabel?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-border/70 bg-background p-5 shadow-sm", className)}>
      <div className="space-y-1.5">
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          <CollectorInfoHint
            help="Ranks are based on average monthly collections. Nationwide rank is computed across all collectors visible to you. Branch rank is computed only inside this collector's branch."
            label="Rank Context"
          />
        </h3>
        <p className="text-sm leading-6 text-muted-foreground">
          Ranking basis: {basisLabel}
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <RankTile countLabel={`${visibleCollectorCount} visible collectors`} rank={nationwideRank} title="Nationwide Rank" />
        <RankTile countLabel={`${branchCollectorCount} in ${branchName}`} rank={branchRank} title="Branch Rank" />
      </div>
    </section>
  );
}

function RankTile({
  title,
  rank,
  countLabel,
}: {
  title: string;
  rank: number;
  countLabel: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">#{rank}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{countLabel}</p>
    </div>
  );
}
