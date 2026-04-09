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

export async function startPasswordRecoveryChallenge(rawIdentifier: string) {
  const resolved = resolvePasswordRecoveryIdentifier(rawIdentifier);
  const matchedUser = await findUserByRecoveryIdentifier(resolved.channel, resolved.identifier);

  if (matchedUser?.userId) {
    if (resolved.channel === "sms") {
      await startSmsVerification(resolved.identifier);
      await setPasswordRecoveryPendingChallenge({
        userId: matchedUser.userId,
        channel: "sms",
        identifier: resolved.identifier,
        maskedDestination: resolved.maskedDestination,
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

export async function resendPasswordRecoveryChallenge() {
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
