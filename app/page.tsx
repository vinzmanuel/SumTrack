import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>SumTrack</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Minimal starter with Supabase auth.
          </p>
          <div className="flex gap-4">
            <Link className="text-sm underline" href="/login">
              Go to login
            </Link>
            <Link className="text-sm underline" href="/dashboard">
              Go to dashboard
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
