import { User } from "lucide-react";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingCollectorProfilePage() {
  return (
    <>
      <DashboardHeaderConfigurator
        config={{
          breadcrumbTitle: "Loading collector...",
          description: "Review collector account details, performance analytics, and assigned loans within your allowed scope.",
          icon: <User className="size-9 text-sidebar-foreground/65" />,
          title: "Collector Details",
        }}
      />
      <div className="space-y-4">
        <Card className="gap-0 overflow-hidden rounded-md py-0">
          <CardContent className="p-5 md:p-6">
            <div className="space-y-2">
              <Skeleton className="h-9 w-72 max-w-full" />
              <Skeleton className="h-4 w-64 max-w-full" />
              <Skeleton className="h-4 w-56 max-w-full" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-md border-border/70 py-0 shadow-sm">
          <CardContent className="space-y-4 p-5">
            <Skeleton className="h-11 w-72 max-w-full" />
            <Skeleton className="h-64 w-full rounded-md" />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
