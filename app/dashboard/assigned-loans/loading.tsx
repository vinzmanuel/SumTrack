import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoadingAssignedLoansPage() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Assigned Loans</CardTitle>
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
