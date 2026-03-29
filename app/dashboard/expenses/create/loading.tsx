import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingCreateExpensePage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 pb-6 pt-0">
      <div className="space-y-4">
        <Skeleton className="h-9 w-36" />

        <Card className="gap-0 overflow-hidden py-0">
          <div className="bg-linear-to-r from-slate-50 via-white to-emerald-50/60 p-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Skeleton className="size-5 rounded-sm" />
                <Skeleton className="h-9 w-56 max-w-full" />
              </div>
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-7 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <label className="space-y-2">
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-10 w-full" />
              </label>

              <label className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full" />
              </label>

              <label className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-24 w-full" />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 w-full" />
                </label>
                <label className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </label>
              </div>

              <Skeleton className="h-10 w-32" />
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
