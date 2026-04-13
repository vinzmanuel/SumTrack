import { Settings2 } from "lucide-react";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingIncentiveRulesPage() {
  return (
    <main className="w-full space-y-4">
      <DashboardHeaderConfigurator
        config={{
          description: "Configure branch-role incentive formulas used by monthly payout computation.",
          icon: <Settings2 className="size-9 text-sidebar-foreground/65" />,
          title: "Incentive Rules",
        }}
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,300px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <Card className="h-fit rounded-md">
          <CardHeader>
            <Skeleton className="h-7 w-28" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <label className="space-y-2">
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-11 w-full rounded-md" />
              </label>
              <label className="space-y-2">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-11 w-full rounded-md" />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-11 w-full rounded-md" />
                </label>
                <label className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-11 w-full rounded-md" />
                </label>
              </div>
              <Skeleton className="h-11 w-full rounded-md" />
            </div>
          </CardContent>
        </Card>

        <div className="min-w-0 flex flex-col gap-5">
          <Card className="min-w-0 gap-0 overflow-hidden rounded-md py-0">
            <CardHeader className="gap-4 py-5">
              <div className="flex flex-col gap-1">
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-4 w-[28rem] max-w-full" />
              </div>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,220px)_minmax(0,220px)]">
                <label className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-11 w-full rounded-md" />
                </label>
                <label className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-11 w-full rounded-md" />
                </label>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="space-y-4">
                <div className="overflow-hidden border-b border-border/70">
                  <div className="border-b px-5 py-3">
                    <div className="grid grid-cols-[140px_150px_130px_120px_130px_140px_140px] gap-4">
                      {Array.from({ length: 7 }).map((_, index) => (
                        <Skeleton className="h-4 w-20" key={index} />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-0">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div className="border-b px-5 py-4 last:border-b-0" key={index}>
                        <div className="grid grid-cols-[140px_150px_130px_120px_130px_140px_140px] items-center gap-4">
                          <Skeleton className="h-5 w-24" />
                          <Skeleton className="h-5 w-28" />
                          <Skeleton className="h-7 w-24 rounded-md" />
                          <Skeleton className="h-5 w-16" />
                          <Skeleton className="h-5 w-20" />
                          <Skeleton className="h-5 w-24" />
                          <Skeleton className="h-5 w-24" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="px-5 pb-5">
                  <div className="flex flex-col gap-3 text-sm md:flex-row md:items-center md:justify-between">
                    <Skeleton className="h-4 w-44" />
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-11 w-[84px] rounded-md" />
                      <Skeleton className="h-9 w-9 rounded-md" />
                      <Skeleton className="h-9 w-9 rounded-md" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
