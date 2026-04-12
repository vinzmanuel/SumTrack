import { ReceiptText } from "lucide-react";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";

export default function LoadingCreateLoanPage() {
  return (
    <>
      <DashboardHeaderConfigurator
        config={{
          action: null,
          description: "Create a new loan record with borrower, collector, and term details.",
          icon: <ReceiptText className="size-9 text-sidebar-foreground/65" />,
          title: "Create Loan",
        }}
      />
      <main className="mx-auto w-full max-w-5xl space-y-4">
        <div className="rounded-md border border-border/70 bg-card px-4 py-4 shadow-sm md:px-5">
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="h-5 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="h-11 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-11 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-5 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-11 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-11 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-11 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
            </div>
            <div className="h-11 w-40 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>
      </main>
    </>
  );
}
