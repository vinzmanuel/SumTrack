import { Gift } from "lucide-react";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingIncentivesPage() {
  return (
    <>
      <DashboardHeaderConfigurator
        config={{
          description: "Review monthly incentive payouts, export results, and finalize eligible batches.",
          icon: <Gift className="size-9 text-sidebar-foreground/65" />,
          title: "Incentive Payouts",
        }}
      />
      <div className="w-full max-w-none space-y-4 pb-6 pt-1 sm:pb-6 sm:pt-2">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex w-full flex-wrap items-center gap-2.5 xl:justify-start">
            <Skeleton className="h-11 w-full rounded-md sm:w-[190px]" />
            <Skeleton className="h-11 w-full rounded-md sm:w-[190px]" />
            <Skeleton className="h-11 w-[88px] rounded-md" />
          </div>
          <Skeleton className="h-11 w-[164px] rounded-md" />
        </div>

        <Card className="overflow-hidden rounded-md py-0">
          <CardContent className="flex flex-col gap-6 py-6">
            <div className="flex items-center gap-3">
              <Skeleton className="size-6 rounded-sm" />
              <Skeleton className="h-8 w-80 max-w-full" />
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <Skeleton className="h-28 rounded-md" />
              <Skeleton className="h-28 rounded-md" />
              <Skeleton className="h-28 rounded-md" />
            </div>

            <div className="overflow-hidden rounded-md border">
              <div className="border-b px-5 py-3">
                <div className="grid grid-cols-[140px_minmax(0,1.9fr)_170px_170px_140px] gap-4">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="ml-auto h-4 w-16" />
                </div>
              </div>
              <div className="space-y-0">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div className="border-b px-5 py-4 last:border-b-0" key={index}>
                    <div className="grid grid-cols-[140px_minmax(0,1.9fr)_170px_170px_140px] items-center gap-4">
                      <Skeleton className="h-7 w-28 rounded-md" />
                      <Skeleton className="h-5 w-52" />
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-7 w-24 rounded-md" />
                      <Skeleton className="ml-auto h-5 w-24" />
                    </div>
                  </div>
                ))}
                <div className="px-5 py-4">
                  <div className="grid grid-cols-[140px_minmax(0,1.9fr)_170px_170px_140px] items-center gap-4">
                    <div />
                    <div />
                    <div />
                    <Skeleton className="h-5 w-14" />
                    <Skeleton className="ml-auto h-5 w-24" />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-md py-0">
          <CardContent className="py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <Skeleton className="h-14 w-full max-w-2xl" />
              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <Skeleton className="h-11 w-24 rounded-md" />
                <Skeleton className="h-11 w-28 rounded-md" />
                <Skeleton className="h-11 w-36 rounded-md" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
