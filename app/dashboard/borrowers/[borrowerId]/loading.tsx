import { User } from "lucide-react";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoadingBorrowerProfilePage() {
  return (
    <>
      <DashboardHeaderConfigurator
        config={{
          breadcrumbTitle: "Loading borrower...",
          description: "Review borrower account details, loan history, and operational documents within your allowed scope.",
          icon: <User className="size-9 text-sidebar-foreground/65" />,
          title: "Borrower Details",
        }}
      />
      <div className="space-y-6">
        <Card className="overflow-hidden rounded-md border-border/70 py-0 shadow-sm">
          <CardHeader>
            <CardTitle>Borrower Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-4 w-60 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
        <Card className="overflow-hidden rounded-md border-border/70 py-0 shadow-sm">
          <CardHeader>
            <div className="h-5 w-44 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="h-4 animate-pulse rounded bg-muted" />
            <div className="h-4 animate-pulse rounded bg-muted" />
            <div className="h-4 animate-pulse rounded bg-muted" />
            <div className="h-4 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
        <Card className="overflow-hidden rounded-md border-border/70 py-0 shadow-sm">
          <CardHeader>
            <div className="h-5 w-32 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="h-8 animate-pulse rounded bg-muted" />
            <div className="h-8 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
