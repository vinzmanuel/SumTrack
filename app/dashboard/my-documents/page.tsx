import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@/app/dashboard/auth";
export default async function MyDocumentsPage() {
  const auth = await requireDashboardAuth(["Borrower"]);
  if (!auth.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{auth.message}</p>
        </CardContent>
      </Card>
    );
  }
  redirect("/dashboard/my-loans");
}
