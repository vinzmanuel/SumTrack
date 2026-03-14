import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { EditManagedUserForm } from "@/app/dashboard/manage-user-accounts/edit-managed-user-form";
import {
  parseManageUserAccountsFilters,
  resolveManageUserAccountsAccess,
} from "@/app/dashboard/manage-user-accounts/filters";
import { loadManagedUserDetail } from "@/app/dashboard/manage-user-accounts/queries";

export default async function EditManagedUserPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const auth = await getDashboardAuthContext();
  const accessState = resolveManageUserAccountsAccess(auth, parseManageUserAccountsFilters({}));

  if (accessState.view !== "staff") {
    return notFound();
  }

  const { userId } = await params;
  const detail = await loadManagedUserDetail(accessState, userId);

  if (!detail || !detail.canEdit) {
    return notFound();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Edit User Account</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Update profile details for {detail.fullName}. Status and archive handling are intentionally separate.
          </p>
        </div>
        <Link href={`/dashboard/manage-user-accounts/${detail.userId}`}>
          <Button type="button" variant="outline">
            Back
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <EditManagedUserForm detail={detail} />
      </CardContent>
    </Card>
  );
}
