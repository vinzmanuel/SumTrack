import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function LoadingDashboardOverview() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-8 w-40 animate-pulse rounded bg-muted" />
            <div className="h-3 w-48 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="h-0" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-2">
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            <div className="h-8 w-36 animate-pulse rounded bg-muted" />
            <div className="h-3 w-44 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="h-0" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-2">
            <div className="h-4 w-36 animate-pulse rounded bg-muted" />
            <div className="h-8 w-32 animate-pulse rounded bg-muted" />
            <div className="h-3 w-40 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="h-0" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-8 w-44 animate-pulse rounded bg-muted" />
            <div className="h-3 w-52 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="h-0" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-8 w-20 animate-pulse rounded bg-muted" />
            <div className="h-3 w-36 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="h-0" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-2">
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            <div className="h-8 w-24 animate-pulse rounded bg-muted" />
            <div className="h-3 w-40 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="h-0" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
