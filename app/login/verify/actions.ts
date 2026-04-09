"use server";

import { redirect } from "next/navigation";
import { getAppSessionAccessState } from "@/app/dashboard/auth";
import {
  hasAdminTwoFactorPendingChallenge,
  setAdminTwoFactorVerified,
} from "@/lib/auth/admin-two-factor";
import { checkSmsVerificationCode } from "@/lib/twilio/verify";
import { startAdminVerificationChallenge } from "@/app/login/verify/helpers";

function getSubmittedCode(formData: FormData) {
  return String(formData.get("code") ?? "").trim();
}

export async function verifyAdminLoginCode(formData: FormData) {
  const authState = await getAppSessionAccessState();
  if (authState.status === "unauthenticated" || authState.status === "missing_app_user" || authState.status === "missing_role") {
    redirect("/login");
  }

  if (authState.status === "non_admin_authenticated" || authState.status === "admin_otp_verified") {
    redirect("/dashboard");
  }

  if (authState.status !== "admin_otp_pending") {
    redirect("/login");
  }

  const auth = authState.auth;
  const code = getSubmittedCode(formData);

  if (!(await hasAdminTwoFactorPendingChallenge(auth.userId))) {
    redirect("/login/verify?error=Request%20a%20new%20verification%20code%20first.");
  }

  try {
    const result = await checkSmsVerificationCode(auth.contactNo, code);

    if (!result.approved) {
      redirect("/login/verify?error=Invalid%20or%20expired%20verification%20code.");
    }

    await setAdminTwoFactorVerified(auth.userId);
    redirect("/dashboard");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to verify the submitted code.";
    redirect(`/login/verify?error=${encodeURIComponent(message)}`);
  }
}

export async function resendAdminLoginCode() {
  try {
    await startAdminVerificationChallenge();
    redirect("/login/verify?resent=1");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to resend the verification code.";
    redirect(`/login/verify?error=${encodeURIComponent(message)}`);
  }
}
