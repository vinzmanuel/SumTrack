import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function LoadingDashboardOverview() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-32 animate-pulse rounded bg-muted" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card><CardContent className="h-28 animate-pulse rounded bg-muted/70" /></Card>
        <Card><CardContent className="h-28 animate-pulse rounded bg-muted/70" /></Card>
        <Card><CardContent className="h-28 animate-pulse rounded bg-muted/70" /></Card>
        <Card><CardContent className="h-28 animate-pulse rounded bg-muted/70" /></Card>
        <Card><CardContent className="h-28 animate-pulse rounded bg-muted/70" /></Card>
        <Card><CardContent className="h-28 animate-pulse rounded bg-muted/70" /></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader className="space-y-3">
            <div className="h-6 w-64 animate-pulse rounded bg-muted" />
            <div className="h-4 w-72 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="h-72 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
        <Card className="xl:col-span-4">
          <CardHeader className="space-y-3">
            <div className="h-6 w-40 animate-pulse rounded bg-muted" />
            <div className="h-4 w-48 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-10 animate-pulse rounded bg-muted" />
            <div className="h-10 animate-pulse rounded bg-muted" />
            <div className="h-10 animate-pulse rounded bg-muted" />
            <div className="h-10 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
