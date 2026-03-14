import { renderRoleAccountProfilePage } from "@/app/dashboard/manage-user-accounts/role-account-profile-page";

export default async function AdminProfilePage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;

  return renderRoleAccountProfilePage({
    companyId,
    expectedRoleName: "Admin",
    title: "Admin Profile",
  });
}
