import "server-only";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  getPasswordRecoveryPendingChallenge,
  resolvePasswordRecoveryIdentifier,
  setPasswordRecoveryPendingChallenge,
  type PasswordRecoveryChannel,
} from "@/lib/auth/password-recovery";
import { logAuditEvent } from "@/lib/audit/logger";
import type { AuditRequestContext } from "@/lib/audit/request-context";
import { generateEmailOtpCode, sendEmailOtpCode } from "@/lib/resend/otp";
import { startSmsVerification } from "@/lib/twilio/verify";

async function findUserByRecoveryIdentifier(
  channel: PasswordRecoveryChannel,
  identifier: string,
) {
  return db
    .select({
      userId: users.user_id,
      contactNo: users.contact_no,
      email: users.email,
    })
    .from(users)
    .where(
      channel === "sms"
        ? eq(users.contact_no, identifier)
        : sql`lower(${users.email}) = ${identifier}`,
    )
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);
}

export async function startPasswordRecoveryChallenge(
  rawIdentifier: string,
  requestContext?: AuditRequestContext,
) {
  const resolved = resolvePasswordRecoveryIdentifier(rawIdentifier);
  const matchedUser = await findUserByRecoveryIdentifier(resolved.channel, resolved.identifier);

  await logAuditEvent({
    action: "auth.password_reset_requested",
    entityType: "auth",
    entityId: matchedUser?.userId ?? resolved.identifier,
    description: `Password reset requested using ${resolved.channel === "sms" ? "mobile number" : "email"}.`,
    target: matchedUser?.userId
      ? {
          userId: matchedUser.userId,
          displayName: resolved.maskedDestination,
        }
      : null,
    requestContext,
    metadata: {
      channel: resolved.channel,
      identifierType: resolved.channel === "sms" ? "contact_no" : "email",
      maskedDestination: resolved.maskedDestination,
      matchedAccount: Boolean(matchedUser?.userId),
    },
  });

  if (matchedUser?.userId) {
    if (resolved.channel === "sms") {
      await startSmsVerification(resolved.identifier);
      await setPasswordRecoveryPendingChallenge({
        userId: matchedUser.userId,
        channel: "sms",
        identifier: resolved.identifier,
        maskedDestination: resolved.maskedDestination,
      });
      await logAuditEvent({
        action: "auth.otp_sent",
        entityType: "auth",
        entityId: matchedUser.userId,
        target: {
          userId: matchedUser.userId,
          displayName: resolved.maskedDestination,
        },
        description: "Sent a password reset code by SMS.",
        requestContext,
        metadata: {
          channel: "sms",
          identifierType: "contact_no",
          maskedDestination: resolved.maskedDestination,
        },
      });
    } else {
      const code = generateEmailOtpCode();
      await sendEmailOtpCode(matchedUser.email, code, {
        subject: "SumTrack password reset code",
        introText: "Your SumTrack password reset code is:",
      });
      await setPasswordRecoveryPendingChallenge({
        userId: matchedUser.userId,
        channel: "email",
        identifier: resolved.identifier,
        maskedDestination: resolved.maskedDestination,
        emailCode: code,
      });
      await logAuditEvent({
        action: "auth.otp_sent",
        entityType: "auth",
        entityId: matchedUser.userId,
        target: {
          userId: matchedUser.userId,
          displayName: resolved.maskedDestination,
        },
        description: "Sent a password reset code by email.",
        requestContext,
        metadata: {
          channel: "email",
          identifierType: "email",
          maskedDestination: resolved.maskedDestination,
        },
      });
    }
  } else {
    await setPasswordRecoveryPendingChallenge({
      userId: null,
      channel: resolved.channel,
      identifier: resolved.identifier,
      maskedDestination: resolved.maskedDestination,
    });
  }

  return {
    channel: resolved.channel,
    maskedDestination: resolved.maskedDestination,
  };
}

export async function resendPasswordRecoveryChallenge(requestContext?: AuditRequestContext) {
  const pending = await getPasswordRecoveryPendingChallenge();
  if (!pending) {
    throw new Error("Start password recovery again to receive a new code.");
  }

  if (pending.userId) {
    if (pending.channel === "sms") {
      await startSmsVerification(pending.identifier);
      await setPasswordRecoveryPendingChallenge({
        userId: pending.userId,
        channel: "sms",
        identifier: pending.identifier,
        maskedDestination: pending.maskedDestination,
      });
      await logAuditEvent({
        action: "auth.otp_sent",
        entityType: "auth",
        entityId: pending.userId,
        target: {
          userId: pending.userId,
          displayName: pending.maskedDestination,
        },
        description: "Resent a password reset code by SMS.",
        requestContext,
        metadata: {
          channel: "sms",
          identifierType: "contact_no",
          maskedDestination: pending.maskedDestination,
          resend: true,
        },
      });
    } else {
      const code = generateEmailOtpCode();
      await sendEmailOtpCode(pending.identifier, code, {
        subject: "SumTrack password reset code",
        introText: "Your SumTrack password reset code is:",
      });
      await setPasswordRecoveryPendingChallenge({
        userId: pending.userId,
        channel: "email",
        identifier: pending.identifier,
        maskedDestination: pending.maskedDestination,
        emailCode: code,
      });
      await logAuditEvent({
        action: "auth.otp_sent",
        entityType: "auth",
        entityId: pending.userId,
        target: {
          userId: pending.userId,
          displayName: pending.maskedDestination,
        },
        description: "Resent a password reset code by email.",
        requestContext,
        metadata: {
          channel: "email",
          identifierType: "email",
          maskedDestination: pending.maskedDestination,
          resend: true,
        },
      });
    }
  } else {
    await setPasswordRecoveryPendingChallenge({
      userId: null,
      channel: pending.channel,
      identifier: pending.identifier,
      maskedDestination: pending.maskedDestination,
    });
  }

  return pending;
}
