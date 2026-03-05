import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoadingMyLoanDetailPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Loan Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-56 animate-pulse rounded bg-muted" />
      </CardContent>
    </Card>
  );
}
