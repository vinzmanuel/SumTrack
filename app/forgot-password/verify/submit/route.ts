import { NextResponse } from "next/server";
import { checkSmsVerificationCode } from "@/lib/twilio/verify";
import {
  getPasswordRecoveryPendingChallenge,
  setPasswordRecoveryVerified,
  verifyPendingPasswordRecoveryEmailOtpCode,
} from "@/lib/auth/password-recovery";

function buildRedirect(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const code = String(formData.get("code") ?? "").trim();
    const pendingChallenge = await getPasswordRecoveryPendingChallenge();

    if (!pendingChallenge?.channel) {
      return buildRedirect(
        request,
        "/forgot-password?error=Start%20password%20recovery%20again.",
      );
    }

    let approved = false;
    if (pendingChallenge.userId) {
      if (pendingChallenge.channel === "sms") {
        const result = await checkSmsVerificationCode(pendingChallenge.identifier, code);
        approved = result.approved;
      } else {
        approved = await verifyPendingPasswordRecoveryEmailOtpCode(code);
      }
    }

    if (!approved || !pendingChallenge.userId) {
      return buildRedirect(
        request,
        "/forgot-password/verify?error=Invalid%20or%20expired%20verification%20code.",
      );
    }

    await setPasswordRecoveryVerified(pendingChallenge.userId);
    return buildRedirect(request, "/forgot-password/reset");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to verify the recovery code.";
    return buildRedirect(
      request,
      `/forgot-password/verify?error=${encodeURIComponent(message)}`,
    );
  }
}
