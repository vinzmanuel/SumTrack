import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoadingLoansPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Loans</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-10 w-full animate-pulse rounded bg-muted md:w-96" />
          <div className="h-9 w-28 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="h-5 w-32 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="h-8 animate-pulse rounded bg-muted" />
          <div className="h-8 animate-pulse rounded bg-muted" />
          <div className="h-8 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    </div>
  );
}
