import { NextResponse } from "next/server";
import { getAppSessionAccessState } from "@/app/dashboard/auth";
import { getAdminTwoFactorPendingChallenge } from "@/lib/auth/admin-two-factor";
import { resolveAdminOtpChannelAvailability } from "@/lib/auth/admin-otp-channels";
import { startAdminVerificationChallenge } from "@/app/login/verify/helpers";
import { getAuditRequestContextFromRequest } from "@/lib/audit/request-context";

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
    const pendingChallenge = await getAdminTwoFactorPendingChallenge(auth.userId);
    const availability = resolveAdminOtpChannelAvailability({
      contactNo: auth.contactNo,
      email: auth.email,
    });
    const channel = pendingChallenge?.channel ?? availability.defaultChannel;

    if (!channel) {
      return buildRedirect(request, "/login/verify?error=Choose%20where%20to%20send%20the%20code%20first.");
    }

    const result = await startAdminVerificationChallenge(channel, getAuditRequestContextFromRequest(request));
    if (result.needsChoice) {
      return buildRedirect(request, "/login/verify?choose=1");
    }

    return buildRedirect(
      request,
      `/login/verify?resent=1&channel=${encodeURIComponent(result.channel)}`,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to resend the verification code.";
    return buildRedirect(request, `/login/verify?error=${encodeURIComponent(message)}`);
  }
}
