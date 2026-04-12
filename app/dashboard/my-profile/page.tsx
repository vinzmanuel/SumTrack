import { notFound } from "next/navigation";
import { CircleUserRound } from "lucide-react";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
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
    <div className="mx-auto max-w-7xl space-y-4">
      <DashboardHeaderConfigurator
        config={{
          action: null,
          description: "Review your account summary and update the profile and login details you are allowed to manage.",
          icon: <CircleUserRound className="size-9 text-sidebar-foreground/65" />,
          title: "My Profile",
        }}
      />

      <div className="grid items-start gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <MyProfileOverviewCard profile={profile} />

        <div className="space-y-6">
          <AccountInformationForm canRequireContactNo={canRequireContactNo} profile={profile} />
          <LoginInformationForm username={profile.username} />
        </div>
      </div>
    </div>
  );
}
