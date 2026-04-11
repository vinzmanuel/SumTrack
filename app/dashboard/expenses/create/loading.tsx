import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingCreateExpensePage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <Card className="rounded-md border border-border/70 bg-card shadow-sm">
        <CardHeader className="space-y-1">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-[26rem] max-w-full" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <label className="space-y-2">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-11 w-full rounded-md bg-muted/70 dark:bg-muted/40" />
            </label>

            <label className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-11 w-full rounded-md bg-muted/70 dark:bg-muted/40" />
            </label>

            <label className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-24 w-full rounded-md" />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-11 w-full rounded-md bg-muted/70 dark:bg-muted/40" />
              </label>
              <label className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-11 w-full rounded-md bg-muted/70 dark:bg-muted/40" />
              </label>
            </div>

            <Skeleton className="h-11 w-36 rounded-md bg-muted/70 dark:bg-muted/40" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
