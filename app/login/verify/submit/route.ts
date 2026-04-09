import { NextResponse } from "next/server";
import { getAppSessionAccessState } from "@/app/dashboard/auth";
import {
  getAdminTwoFactorPendingChallenge,
  setAdminTwoFactorVerified,
  verifyPendingAdminEmailOtpCode,
} from "@/lib/auth/admin-two-factor";
import { checkSmsVerificationCode } from "@/lib/twilio/verify";

function buildRedirect(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function POST(request: Request) {
  try {
    const authState = await getAppSessionAccessState();
    if (
      authState.status === "unauthenticated" ||
      authState.status === "missing_app_user" ||
      authState.status === "missing_role"
    ) {
      return buildRedirect(request, "/login");
    }

    if (authState.status === "non_admin_authenticated" || authState.status === "admin_otp_verified") {
      return buildRedirect(request, "/dashboard");
    }

    if (authState.status !== "admin_otp_pending") {
      return buildRedirect(request, "/login");
    }

    const auth = authState.auth;

    const formData = await request.formData();
    const code = String(formData.get("code") ?? "").trim();
    const pendingChallenge = await getAdminTwoFactorPendingChallenge(auth.userId);
    if (!pendingChallenge?.channel) {
      return buildRedirect(
        request,
        "/login/verify?error=Request%20a%20new%20verification%20code%20first.",
      );
    }

    let approved = false;
    if (pendingChallenge.channel === "sms") {
      const result = await checkSmsVerificationCode(auth.contactNo, code);
      approved = result.approved;
    } else if (pendingChallenge.channel === "email") {
      approved = await verifyPendingAdminEmailOtpCode(auth.userId, code);
    }

    if (!approved) {
      return buildRedirect(
        request,
        "/login/verify?error=Invalid%20or%20expired%20verification%20code.",
      );
    }

    await setAdminTwoFactorVerified(auth.userId);
    return buildRedirect(request, "/dashboard");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to verify the submitted code.";
    return buildRedirect(request, `/login/verify?error=${encodeURIComponent(message)}`);
  }
}
