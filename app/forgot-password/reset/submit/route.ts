import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  clearPasswordRecoveryCookies,
  getPasswordRecoveryVerifiedChallenge,
  issuePasswordRecoveryLoginBypass,
} from "@/lib/auth/password-recovery";
import { getAuditRequestContextFromRequest } from "@/lib/audit/request-context";
import { logAuditEvent } from "@/lib/audit/logger";
import { createAdminClient } from "@/lib/supabase/admin";

function buildRedirect(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function POST(request: Request) {
  try {
    const requestContext = getAuditRequestContextFromRequest(request);
    const verifiedChallenge = await getPasswordRecoveryVerifiedChallenge();
    if (!verifiedChallenge?.userId) {
      return buildRedirect(
        request,
        "/forgot-password?error=Start%20password%20recovery%20again.",
      );
    }

    const formData = await request.formData();
    const newPassword = String(formData.get("new_password") ?? "");
    const confirmPassword = String(formData.get("confirm_password") ?? "");

    if (!newPassword || !confirmPassword) {
      return buildRedirect(request, "/forgot-password/reset?error=Fill%20in%20all%20password%20fields.");
    }

    if (newPassword.length < 8) {
      return buildRedirect(
        request,
        "/forgot-password/reset?error=New%20password%20must%20be%20at%20least%208%20characters%20long.",
      );
    }

    if (newPassword !== confirmPassword) {
      return buildRedirect(
        request,
        "/forgot-password/reset?error=New%20password%20and%20confirmation%20do%20not%20match.",
      );
    }

    const adminClient = createAdminClient();
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      verifiedChallenge.userId,
      {
        password: newPassword,
      },
    );

    if (updateError) {
      return buildRedirect(
        request,
        `/forgot-password/reset?error=${encodeURIComponent(updateError.message || "Unable to update password right now.")}`,
      );
    }

    await db
      .update(users)
      .set({
        updated_at: new Date().toISOString(),
      })
      .where(eq(users.user_id, verifiedChallenge.userId));

    await clearPasswordRecoveryCookies();
    await issuePasswordRecoveryLoginBypass(verifiedChallenge.userId);
    await logAuditEvent({
      action: "auth.password_reset_completed",
      entityType: "auth",
      entityId: verifiedChallenge.userId,
      target: {
        userId: verifiedChallenge.userId,
      },
      description: "Password reset completed successfully.",
      requestContext,
      metadata: {
        postResetBypassIssued: true,
      },
    });

    return buildRedirect(
      request,
      "/login?message=Password%20updated.%20Log%20in%20with%20your%20new%20password.",
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to reset the password.";
    return buildRedirect(
      request,
      `/forgot-password/reset?error=${encodeURIComponent(message)}`,
    );
  }
}
