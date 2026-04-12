import { FileChartColumn } from "lucide-react";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";

export default function LoadingLoanDetailPage() {
  return (
    <div className="space-y-4">
      <DashboardHeaderConfigurator
        config={{
          action: null,
          description: "Review loan summary, passbook entries, and repayment progression.",
          icon: <FileChartColumn className="size-9 text-sidebar-foreground/65" />,
          title: "Loan View",
        }}
      />
      <div className="rounded-md border border-border/70 bg-card p-5 shadow-sm">
        <div className="space-y-3">
          <div className="h-8 w-56 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 w-72 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
      <div className="rounded-md border border-border/70 bg-card p-5 shadow-sm">
        <div className="space-y-3">
          <div className="h-5 w-36 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="h-11 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-11 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div className="h-64 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
    </div>
  );
}
