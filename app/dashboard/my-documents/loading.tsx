import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoadingMyDocumentsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>My Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-9 w-28 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="h-5 w-44 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="h-8 animate-pulse rounded bg-muted" />
          <div className="h-8 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    </div>
  );
}
