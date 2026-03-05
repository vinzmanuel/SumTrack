import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoadingMyCollectionsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My Collections</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="h-8 animate-pulse rounded bg-muted" />
        <div className="h-8 animate-pulse rounded bg-muted" />
        <div className="h-8 animate-pulse rounded bg-muted" />
      </CardContent>
    </Card>
  );
}
