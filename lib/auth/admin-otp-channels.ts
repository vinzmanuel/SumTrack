import "server-only";

import { maskOtpEmail, normalizeOtpEmail, assertResendReady } from "@/lib/resend/otp";
import {
  assertTwilioVerifyReady,
  maskPhilippineMobile,
  normalizePhilippineMobileToE164,
} from "@/lib/twilio/verify";

export type AdminOtpChannel = "sms" | "email";

export type AdminOtpChannelAvailability = {
  availableChannels: AdminOtpChannel[];
  defaultChannel: AdminOtpChannel | null;
  hasChoice: boolean;
  maskedPhone: string | null;
  maskedEmail: string | null;
  errorMessage: string | null;
};

export function resolveAdminOtpChannelAvailability(input: {
  contactNo: string | null | undefined;
  email: string | null | undefined;
}): AdminOtpChannelAvailability {
  const availableChannels: AdminOtpChannel[] = [];
  let maskedPhone: string | null = null;
  let maskedEmail: string | null = null;

  try {
    assertTwilioVerifyReady();
    normalizePhilippineMobileToE164(input.contactNo);
    maskedPhone = maskPhilippineMobile(input.contactNo);
    availableChannels.push("sms");
  } catch {
    maskedPhone = null;
  }

  try {
    assertResendReady();
    normalizeOtpEmail(input.email);
    maskedEmail = maskOtpEmail(input.email);
    availableChannels.push("email");
  } catch {
    maskedEmail = null;
  }

  return {
    availableChannels,
    defaultChannel: availableChannels.length === 1 ? availableChannels[0] : null,
    hasChoice: availableChannels.length > 1,
    maskedPhone,
    maskedEmail,
    errorMessage:
      availableChannels.length === 0
        ? "No OTP destination is available for this Admin account."
        : null,
  };
}
