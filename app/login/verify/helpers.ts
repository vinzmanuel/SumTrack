import "server-only";

import { redirect } from "next/navigation";
import { getAppSessionAccessState } from "@/app/dashboard/auth";
import {
  getAdminTwoFactorPendingChallenge,
  hasAdminTwoFactorPendingChallenge,
  setAdminTwoFactorPendingChallenge,
} from "@/lib/auth/admin-two-factor";
import {
  type AdminOtpChannel,
  resolveAdminOtpChannelAvailability,
} from "@/lib/auth/admin-otp-channels";
import { buildAuditActorFromAuth, logAuditEvent } from "@/lib/audit/logger";
import type { AuditRequestContext } from "@/lib/audit/request-context";
import { generateEmailOtpCode, sendEmailOtpCode } from "@/lib/resend/otp";
import { startSmsVerification } from "@/lib/twilio/verify";

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
  const availability = resolveAdminOtpChannelAvailability({
    contactNo: auth.contactNo,
    email: auth.email,
  });
  const pendingChallenge = await getAdminTwoFactorPendingChallenge(auth.userId);

  return {
    auth,
    hasPendingChallenge: await hasAdminTwoFactorPendingChallenge(auth.userId),
    availability,
    pendingChallenge,
  };
}

export async function startAdminVerificationChallenge(
  channel?: AdminOtpChannel,
  requestContext?: AuditRequestContext,
) {
  const { auth } = await resolvePendingAdminVerificationContext();
  const availability = resolveAdminOtpChannelAvailability({
    contactNo: auth.contactNo,
    email: auth.email,
  });

  if (availability.availableChannels.length === 0) {
    throw new Error(
      availability.errorMessage ?? "No OTP destination is available for this Admin account.",
    );
  }

  const selectedChannel =
    channel ??
    availability.defaultChannel;

  if (!selectedChannel) {
    return { needsChoice: true as const };
  }

  if (!availability.availableChannels.includes(selectedChannel)) {
    throw new Error("The selected verification channel is unavailable for this Admin account.");
  }

  if (selectedChannel === "sms") {
    await startSmsVerification(auth.contactNo);
    await setAdminTwoFactorPendingChallenge(auth.userId, { channel: "sms" });
    await logAuditEvent({
      action: "auth.otp_sent",
      entityType: "auth",
      entityId: auth.userId,
      actor: buildAuditActorFromAuth(auth),
      target: {
        userId: auth.userId,
        companyId: auth.companyId,
        displayName: auth.displayName,
      },
      description: `Sent a verification code by SMS to ${auth.displayName}.`,
      branchId: auth.activeBranchId,
      branchScope: auth.assignedBranchIds,
      requestContext,
      metadata: {
        channel: "sms",
        identifierType: "contact_no",
      },
    });
    return { channel: "sms" as const, needsChoice: false as const };
  }

  const code = generateEmailOtpCode();
  await sendEmailOtpCode(auth.email, code);
  await setAdminTwoFactorPendingChallenge(auth.userId, {
    channel: "email",
    emailCode: code,
  });
  await logAuditEvent({
    action: "auth.otp_sent",
    entityType: "auth",
    entityId: auth.userId,
    actor: buildAuditActorFromAuth(auth),
    target: {
      userId: auth.userId,
      companyId: auth.companyId,
      displayName: auth.displayName,
    },
    description: `Sent a verification code by email to ${auth.displayName}.`,
    branchId: auth.activeBranchId,
    branchScope: auth.assignedBranchIds,
    requestContext,
    metadata: {
      channel: "email",
      identifierType: "email",
    },
  });

  return { channel: "email" as const, needsChoice: false as const };
}
