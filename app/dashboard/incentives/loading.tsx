import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoadingIncentivesPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl p-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Incentive Payouts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-4 w-56 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="h-5 w-44 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-10 animate-pulse rounded bg-muted" />
          <div className="h-10 animate-pulse rounded bg-muted" />
          <div className="h-10 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    </main>
  );
}
