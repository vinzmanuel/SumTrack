"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Building2, FileText, MapPin, TriangleAlert, Users, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { BranchNetworkCardData } from "@/app/dashboard/branches/types";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}

function StatTile({
  iconClassName,
  icon,
  label,
  value,
}: {
  iconClassName?: string;
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
      <div className="mb-1 flex items-center gap-2 text-muted-foreground">
        <span className={`flex h-7 w-7 items-center justify-center rounded-md ${iconClassName ?? ""}`}>{icon}</span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function BranchNetworkCard({ branch }: { branch: BranchNetworkCardData }) {
  const href = `/dashboard/branches/${encodeURIComponent(branch.branchCode)}?source=branches&returnTo=${encodeURIComponent("/dashboard/branches")}`;

  return (
    <Link className="group block h-full" href={href}>
      <Card className="h-full overflow-hidden border-border/70 py-0 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
        <CardContent className="flex h-full flex-col p-0">
          <div className="bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_34%),linear-gradient(180deg,rgba(248,250,252,0.96),rgba(240,253,244,0.72))] px-4 pb-4 pt-4">  
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-lg font-semibold text-foreground transition-colors group-hover:text-emerald-700">
                        {branch.branchName}
                      </h3>
                      <Badge className="border-zinc-300 bg-background px-3 py-1 text-xs font-semibold text-zinc-700" variant="outline">
                        {branch.branchCode}
                      </Badge>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span className="truncate">{branch.municipalityName}, {branch.provinceName}</span>
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground transition-colors group-hover:text-foreground">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-border/70 bg-white px-4 py-3">
              <Badge className="border-amber-200 bg-amber-50 text-amber-700" variant="outline">
                Branch Manager
              </Badge>
              <p className="mt-2 text-sm font-medium text-foreground">{branch.managerName ?? "No active manager assigned"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {branch.managerCompanyId ? `Company ID: ${branch.managerCompanyId}` : branch.branchAddress}
              </p>
            </div>
          </div>

          <div className="border-t border-border/70 px-4 pb-4 pt-4">
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.25fr]">
              <StatTile
                icon={<Users className="h-4 w-4 text-emerald-600" />}
                iconClassName="bg-emerald-50"
                label="Collectors"
                value={String(branch.collectorCount)}
              />
              <StatTile
                icon={<Users className="h-4 w-4 text-zinc-500" />}
                iconClassName="border border-zinc-200 bg-zinc-50"
                label="Borrowers"
                value={String(branch.borrowerCount)}
              />
              <StatTile
                icon={<TriangleAlert className="h-4 w-4 text-amber-700" />}
                iconClassName="bg-amber-300/50"
                label="Overdue Loans"
                value={String(branch.overdueLoanCount)}
              />
            </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <StatTile
                  icon={<Wallet className="h-4 w-4 text-emerald-600" />}
                  iconClassName="bg-emerald-50"
                  label="Collections This Month"
                  value={formatCurrency(branch.collectionsThisMonth)}
                />
                <StatTile
                  icon={<FileText className="h-4 w-4 text-blue-600" />}
                  iconClassName="bg-blue-50"
                  label="Active Loans"
                  value={String(branch.activeLoanCount)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
