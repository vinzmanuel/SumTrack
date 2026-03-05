import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoadingLoanDetailPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Loan Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-4 w-56 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="h-5 w-36 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    </div>
  );
}
