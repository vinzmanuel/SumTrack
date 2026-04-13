"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Building2, FileText, MapPin, TriangleAlert, Users, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getUiRoleBadgeClassName } from "@/app/dashboard/_components/ui-patterns";
import type { BranchNetworkCardData } from "@/app/dashboard/branches/types";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}

function StatTile({
  icon,
  label,
  value,
  tone = "zinc",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: "emerald" | "blue" | "amber" | "zinc";
}) {
  const iconToneClassName =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
      : tone === "blue"
        ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300"
        : tone === "amber"
          ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
          : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100";

  return (
    <div className="rounded-md border border-border/70 bg-card px-3 py-2.5">
      <div className="mb-1 flex items-center gap-2 text-muted-foreground">
        <span className={`flex h-7 w-7 items-center justify-center rounded-md border ${iconToneClassName}`}>{icon}</span>
        <span className="text-sm">{label}</span>
      </div>
      <p className="text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function BranchNetworkCard({ branch }: { branch: BranchNetworkCardData }) {
  const href = `/dashboard/branches/${encodeURIComponent(branch.branchCode)}?source=branches&returnTo=${encodeURIComponent("/dashboard/branches")}`;

  return (
    <Link className="group block h-full" href={href}>
      <Card className="h-full overflow-hidden rounded-md border-border/70 py-0 shadow-sm transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-border/90 group-hover:shadow-md">
        <CardContent className="flex h-full flex-col gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border/70 bg-card text-muted-foreground">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-lg font-semibold text-foreground">{branch.branchName}</h3>
                    <Badge className="rounded-md border-zinc-200 bg-zinc-100 py-1 text-zinc-700 dark:border-zinc-500/30 dark:bg-zinc-500/10 dark:text-zinc-300" variant="outline">
                      {branch.branchCode}
                    </Badge>
                  </div>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span className="truncate">{branch.municipalityName}, {branch.provinceName}</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/70 bg-card text-muted-foreground transition-colors group-hover:text-foreground">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>

          <div className="rounded-md border border-border/70 bg-card px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={getUiRoleBadgeClassName("Branch Manager")} variant="outline">
                Branch Manager
              </Badge>
              <Badge
                className={
                  branch.status === "active"
                    ? "rounded-md border-emerald-200 bg-emerald-50 py-1 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                    : "rounded-md border-amber-200 bg-amber-50 py-1 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                }
                variant="outline"
              >
                {branch.status === "active" ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="mt-2 text-sm font-medium text-foreground">{branch.managerName ?? "No active manager assigned"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {branch.managerCompanyId ? `Company ID: ${branch.managerCompanyId}` : branch.branchAddress}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <StatTile
              icon={<Users className="h-4 w-4" />}
              label="Collectors"
              tone="emerald"
              value={String(branch.collectorCount)}
            />
            <StatTile
              icon={<Users className="h-4 w-4" />}
              label="Borrowers"
              tone="zinc"
              value={String(branch.borrowerCount)}
            />
            <StatTile
              icon={<TriangleAlert className="h-4 w-4" />}
              label="Overdue Loans"
              tone="amber"
              value={String(branch.overdueLoanCount)}
            />
            <StatTile
              icon={<FileText className="h-4 w-4" />}
              label="Active Loans"
              tone="blue"
              value={String(branch.activeLoanCount)}
            />
            <div className="sm:col-span-2">
              <StatTile
                icon={<Wallet className="h-4 w-4" />}
                label="Collections This Month"
                tone="emerald"
                value={formatCurrency(branch.collectionsThisMonth)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
