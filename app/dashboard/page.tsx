import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

type AppUser = {
  user_id: string;
  username: string | null;
  role_id: string | null;
};

type Role = {
  role_name: string;
};

type EmployeeInfo = {
  first_name: string | null;
  last_name: string | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Not logged in</p>
            <Link className="mt-3 inline-block text-sm underline" href="/login">
              Go to login
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const { data: appUser } = await supabase
    .from("users")
    .select("user_id, username, role_id")
    .eq("user_id", user.id)
    .maybeSingle<AppUser>();

  const { data: role } = appUser?.role_id
    ? await supabase
        .from("roles")
        .select("role_name")
        .eq("role_id", appUser.role_id)
        .maybeSingle<Role>()
    : { data: null };

  const { data: employeeInfo } = appUser
    ? await supabase
        .from("employee_info")
        .select("first_name, last_name")
        .eq("user_id", user.id)
        .maybeSingle<EmployeeInfo>()
    : { data: null };

  const fullName = [employeeInfo?.first_name, employeeInfo?.last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl p-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>
            Authenticated session and linked application profile
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/loans">
              <Button type="button" variant="secondary">
                View loans
              </Button>
            </Link>
            <Link href="/dashboard/create-account">
              <Button type="button">Create account</Button>
            </Link>
            <Link href="/dashboard/create-loan">
              <Button type="button" variant="secondary">
                Create loan
              </Button>
            </Link>
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="outline">
                Sign out
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Auth Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              <span className="font-medium">Auth User ID:</span> {user.id}
            </p>
            <p className="text-sm">
              <span className="font-medium">Auth Email:</span> {user.email ?? "N/A"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Application Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!appUser ? (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Authenticated user exists, but no app user record was found.
              </p>
            ) : (
              <>
                <p className="text-sm">
                  <span className="font-medium">Username:</span> {appUser.username ?? "N/A"}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Role:</span> {role?.role_name ?? "N/A"}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Full Name:</span> {fullName || "N/A"}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
