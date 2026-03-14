import { notFound } from "next/navigation";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { AccountInformationForm } from "@/app/dashboard/settings/account-information-form";
import { LoginInformationForm } from "@/app/dashboard/settings/login-information-form";
import { MyProfileOverviewCard } from "@/app/dashboard/settings/my-profile-overview-card";
import { loadSelfProfile } from "@/app/dashboard/settings/queries";

export default async function MyProfilePage() {
  const auth = await requireDashboardAuth();

  if (!auth.ok) {
    return notFound();
  }

  const profile = await loadSelfProfile(auth.userId);
  if (!profile) {
    return notFound();
  }

  const canRequireContactNo = auth.roleName === "Borrower" || auth.roleName === "Collector";

  return (
    <div className="mx-auto max-w-7xl">
      <div className="grid items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <MyProfileOverviewCard profile={profile} />

        <div className="space-y-6">
          <AccountInformationForm canRequireContactNo={canRequireContactNo} profile={profile} />
          <LoginInformationForm username={profile.username} />
        </div>
      </div>
    </div>
  );
}
