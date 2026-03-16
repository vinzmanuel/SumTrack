import { renderRoleAccountProfilePage } from "@/app/dashboard/manage-user-accounts/role-account-profile-page";

export default async function AuditorProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams?: Promise<{ source?: string; returnTo?: string }>;
}) {
  const { companyId } = await params;

  return renderRoleAccountProfilePage({
    companyId,
    expectedRoleName: "Auditor",
    searchParams,
    title: "Auditor Profile",
  });
}
