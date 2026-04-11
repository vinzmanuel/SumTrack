import { NextResponse } from "next/server";
import { getAppSessionAccessState } from "@/app/dashboard/auth";
import type { AdminOtpChannel } from "@/lib/auth/admin-otp-channels";
import { startAdminVerificationChallenge } from "@/app/login/verify/helpers";
import { getAuditRequestContextFromRequest } from "@/lib/audit/request-context";

function buildRedirect(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

function parseChannel(value: FormDataEntryValue | null): AdminOtpChannel | null {
  return value === "sms" || value === "email" ? value : null;
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

    const formData = await request.formData();
    const channel = parseChannel(formData.get("channel"));
    if (!channel) {
      return buildRedirect(request, "/login/verify?error=Choose%20a%20verification%20channel.");
    }

    const result = await startAdminVerificationChallenge(channel, getAuditRequestContextFromRequest(request));
    if (result.needsChoice) {
      return buildRedirect(request, "/login/verify?choose=1");
    }

    return buildRedirect(
      request,
      `/login/verify?sent=1&channel=${encodeURIComponent(result.channel)}`,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to send the verification code.";
    return buildRedirect(request, `/login/verify?error=${encodeURIComponent(message)}`);
  }
}
