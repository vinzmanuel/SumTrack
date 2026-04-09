import { NextResponse } from "next/server";
import { getAppSessionAccessState } from "@/app/dashboard/auth";
import { setAdminTwoFactorPendingChallenge } from "@/lib/auth/admin-two-factor";
import { startSmsVerification } from "@/lib/twilio/verify";

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

    await startSmsVerification(auth.contactNo);
    await setAdminTwoFactorPendingChallenge(auth.userId);
    return buildRedirect(request, "/login/verify?resent=1");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to resend the verification code.";
    return buildRedirect(request, `/login/verify?error=${encodeURIComponent(message)}`);
  }
}
