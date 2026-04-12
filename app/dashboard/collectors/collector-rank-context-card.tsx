import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CollectorInfoHint } from "@/app/dashboard/collectors/collector-info-hint";
import {
  collectorRankBadgeClassName,
  collectorRankCardClassName,
} from "@/app/dashboard/collectors/collectors-rank-styles";
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
    <Card className={cn("gap-0 overflow-hidden rounded-md py-0", className)}>
      <CardHeader className="gap-0 pb-3 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold tracking-tight">
              <CollectorInfoHint
                help="Ranks are based on the active period view. Nationwide rank compares against every visible collector in your current scope. Branch rank compares only within this collector's branch."
                label="Rank Context"
              />
            </CardTitle>
            <CardDescription className="text-sm leading-6">{basisLabel}</CardDescription>
          </div>
          <Badge className="border-zinc-200 bg-zinc-50 text-zinc-700" variant="outline">
            {visibleCollectorCount} visible
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 pb-6 pt-0 sm:grid-cols-2">
        <RankTile countLabel={`${visibleCollectorCount} visible collectors`} rank={nationwideRank} title="Nationwide" />
        <RankTile countLabel={`${branchCollectorCount} in ${branchName}`} rank={branchRank} title="Branch" />
      </CardContent>
    </Card>
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
    <div className={cn("rounded-md border p-4", collectorRankCardClassName(rank))}>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <Badge className={cn("mt-3 px-4 py-1.5 text-sm", collectorRankBadgeClassName(rank))} variant="outline">
          #{rank}
      </Badge>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{countLabel}</p>
    </div>
  );
}
