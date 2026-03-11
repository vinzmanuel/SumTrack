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
      <Card className="min-h-[470px]">
        <CardHeader className="space-y-4">
          <div className="space-y-2">
            <div className="h-8 w-64 animate-pulse rounded bg-muted" />
            <div className="h-5 w-72 animate-pulse rounded bg-muted" />
          </div>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="grid flex-1 gap-3 md:grid-cols-2 xl:max-w-2xl xl:grid-cols-3">
              <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
              <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
              <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
            </div>
            <div className="h-10 w-24 animate-pulse rounded-lg bg-muted" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[340px] animate-pulse rounded-xl bg-muted md:h-[380px]" />
        </CardContent>
      </Card>
    </div>
  );
}
