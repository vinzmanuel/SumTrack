import "server-only";

import { redirect } from "next/navigation";
import { getAppSessionAccessState } from "@/app/dashboard/auth";
import {
  hasAdminTwoFactorPendingChallenge,
  setAdminTwoFactorPendingChallenge,
} from "@/lib/auth/admin-two-factor";
import { maskPhilippineMobile, startSmsVerification } from "@/lib/twilio/verify";

export async function resolvePendingAdminVerificationContext() {
  const authState = await getAppSessionAccessState();

  if (
    authState.status === "unauthenticated" ||
    authState.status === "missing_app_user" ||
    authState.status === "missing_role"
  ) {
    redirect("/login");
  }

  if (authState.status === "non_admin_authenticated") {
    redirect("/dashboard");
  }

  if (authState.status === "admin_otp_verified") {
    redirect("/dashboard");
  }

  if (authState.status !== "admin_otp_pending") {
    redirect("/login");
  }

  const auth = authState.auth;

  return {
    auth,
    hasPendingChallenge: await hasAdminTwoFactorPendingChallenge(auth.userId),
    maskedPhone: maskPhilippineMobile(auth.contactNo),
  };
}

export async function startAdminVerificationChallenge() {
  const { auth } = await resolvePendingAdminVerificationContext();
  await startSmsVerification(auth.contactNo);
  await setAdminTwoFactorPendingChallenge(auth.userId);
}
