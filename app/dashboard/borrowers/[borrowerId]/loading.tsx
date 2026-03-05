import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoadingBorrowerProfilePage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl p-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Borrower Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-4 w-60 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
      <Card className="mb-6">
        <CardHeader>
          <div className="h-5 w-44 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="h-4 animate-pulse rounded bg-muted" />
          <div className="h-4 animate-pulse rounded bg-muted" />
          <div className="h-4 animate-pulse rounded bg-muted" />
          <div className="h-4 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="h-5 w-32 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="h-8 animate-pulse rounded bg-muted" />
          <div className="h-8 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    </main>
  );
}
