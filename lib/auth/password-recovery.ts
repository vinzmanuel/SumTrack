import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  isValidEmailAddress,
  isValidPhilippineMobile,
  normalizeAccountContactNo,
  normalizeAccountEmail,
} from "@/app/dashboard/account-field-validation";

const PASSWORD_RECOVERY_PENDING_COOKIE = "sumtrack_password_recovery_pending";
const PASSWORD_RECOVERY_VERIFIED_COOKIE = "sumtrack_password_recovery_verified";
const PASSWORD_RECOVERY_BYPASS_COOKIE = "sumtrack_password_recovery_bypass";

const PASSWORD_RECOVERY_PENDING_MAX_AGE_SECONDS = 60 * 10;
const PASSWORD_RECOVERY_VERIFIED_MAX_AGE_SECONDS = 60 * 15;
const PASSWORD_RECOVERY_BYPASS_MAX_AGE_SECONDS = 60 * 20;

export type PasswordRecoveryChannel = "sms" | "email";
type PasswordRecoveryPurpose = "pending" | "verified" | "bypass";

type PasswordRecoveryTokenPayload = {
  purpose: PasswordRecoveryPurpose;
  issuedAt: number;
  expiresAt: number;
  userId?: string | null;
  channel?: PasswordRecoveryChannel;
  identifier?: string;
  maskedDestination?: string;
  emailCodeHash?: string | null;
};

function getPasswordRecoverySigningSecret() {
  const secret =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.TWILIO_AUTH_TOKEN ||
    process.env.RESEND_API_KEY;

  if (!secret) {
    throw new Error("Missing password recovery signing configuration.");
  }

  return secret;
}

function getCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

function getCookieName(purpose: PasswordRecoveryPurpose) {
  if (purpose === "pending") {
    return PASSWORD_RECOVERY_PENDING_COOKIE;
  }

  if (purpose === "verified") {
    return PASSWORD_RECOVERY_VERIFIED_COOKIE;
  }

  return PASSWORD_RECOVERY_BYPASS_COOKIE;
}

function encodePayload(payload: PasswordRecoveryTokenPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", getPasswordRecoverySigningSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function createSignedToken(payload: PasswordRecoveryTokenPayload) {
  const encodedPayload = encodePayload(payload);
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

function decodeSignedToken(token: string | undefined, expectedPurpose: PasswordRecoveryPurpose) {
  if (!token) {
    return null;
  }

  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as PasswordRecoveryTokenPayload;

    if (
      payload.purpose !== expectedPurpose ||
      typeof payload.issuedAt !== "number" ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Date.now()
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

async function readTokenPayload(expectedPurpose: PasswordRecoveryPurpose) {
  const cookieStore = await cookies();
  return decodeSignedToken(cookieStore.get(getCookieName(expectedPurpose))?.value, expectedPurpose);
}

function hashOtpCode(code: string) {
  return createHmac("sha256", getPasswordRecoverySigningSecret())
    .update(code)
    .digest("base64url");
}

export function maskRecoveryPhone(contactNo: string) {
  return `${contactNo.slice(0, 4)}****${contactNo.slice(-3)}`;
}

export function maskRecoveryEmail(email: string) {
  const [localPart, domain] = email.split("@");
  if (!domain) {
    return "your email address";
  }

  if (localPart.length <= 2) {
    return `${localPart.charAt(0) || "*"}***@${domain}`;
  }

  return `${localPart.slice(0, 2)}***@${domain}`;
}

export function resolvePasswordRecoveryIdentifier(rawValue: string) {
  const value = String(rawValue ?? "").trim();
  if (!value) {
    throw new Error("Enter your email or mobile number.");
  }

  if (value.includes("@")) {
    const normalizedEmail = normalizeAccountEmail(value);
    if (!isValidEmailAddress(normalizedEmail)) {
      throw new Error("Enter a valid email or mobile number.");
    }

    return {
      channel: "email" as const,
      identifier: normalizedEmail,
      maskedDestination: maskRecoveryEmail(normalizedEmail),
    };
  }

  const normalizedPhone = normalizeAccountContactNo(value);
  if (!isValidPhilippineMobile(normalizedPhone)) {
    throw new Error("Enter a valid email or mobile number.");
  }

  return {
    channel: "sms" as const,
    identifier: normalizedPhone,
    maskedDestination: maskRecoveryPhone(normalizedPhone),
  };
}

export async function setPasswordRecoveryPendingChallenge(input: {
  userId?: string | null;
  channel: PasswordRecoveryChannel;
  identifier: string;
  maskedDestination: string;
  emailCode?: string | null;
}) {
  const cookieStore = await cookies();
  const now = Date.now();

  cookieStore.set(
    PASSWORD_RECOVERY_PENDING_COOKIE,
    createSignedToken({
      purpose: "pending",
      issuedAt: now,
      expiresAt: now + PASSWORD_RECOVERY_PENDING_MAX_AGE_SECONDS * 1000,
      userId: input.userId ?? null,
      channel: input.channel,
      identifier: input.identifier,
      maskedDestination: input.maskedDestination,
      emailCodeHash: input.emailCode ? hashOtpCode(input.emailCode) : null,
    }),
    getCookieOptions(PASSWORD_RECOVERY_PENDING_MAX_AGE_SECONDS),
  );
  cookieStore.delete(PASSWORD_RECOVERY_VERIFIED_COOKIE);
}

export async function getPasswordRecoveryPendingChallenge() {
  const payload = await readTokenPayload("pending");
  if (!payload?.channel || !payload.identifier || !payload.maskedDestination) {
    return null;
  }

  return {
    userId: payload.userId ?? null,
    channel: payload.channel,
    identifier: payload.identifier,
    maskedDestination: payload.maskedDestination,
    emailCodeHash: payload.emailCodeHash ?? null,
    expiresAt: payload.expiresAt,
  };
}

export async function verifyPendingPasswordRecoveryEmailOtpCode(code: string) {
  const pending = await getPasswordRecoveryPendingChallenge();
  if (!pending || pending.channel !== "email" || !pending.emailCodeHash) {
    return false;
  }

  const normalizedCode = code.replace(/\D/g, "").trim();
  const providedBuffer = Buffer.from(hashOtpCode(normalizedCode));
  const expectedBuffer = Buffer.from(pending.emailCodeHash);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function setPasswordRecoveryVerified(userId: string) {
  const cookieStore = await cookies();
  const now = Date.now();

  cookieStore.set(
    PASSWORD_RECOVERY_VERIFIED_COOKIE,
    createSignedToken({
      purpose: "verified",
      issuedAt: now,
      expiresAt: now + PASSWORD_RECOVERY_VERIFIED_MAX_AGE_SECONDS * 1000,
      userId,
    }),
    getCookieOptions(PASSWORD_RECOVERY_VERIFIED_MAX_AGE_SECONDS),
  );
  cookieStore.delete(PASSWORD_RECOVERY_PENDING_COOKIE);
}

export async function getPasswordRecoveryVerifiedChallenge() {
  const payload = await readTokenPayload("verified");
  if (!payload?.userId) {
    return null;
  }

  return {
    userId: payload.userId,
    expiresAt: payload.expiresAt,
  };
}

export async function issuePasswordRecoveryLoginBypass(userId: string) {
  const cookieStore = await cookies();
  const now = Date.now();

  cookieStore.set(
    PASSWORD_RECOVERY_BYPASS_COOKIE,
    createSignedToken({
      purpose: "bypass",
      issuedAt: now,
      expiresAt: now + PASSWORD_RECOVERY_BYPASS_MAX_AGE_SECONDS * 1000,
      userId,
    }),
    getCookieOptions(PASSWORD_RECOVERY_BYPASS_MAX_AGE_SECONDS),
  );
}

export async function consumePasswordRecoveryLoginBypass(userId: string) {
  const cookieStore = await cookies();
  const payload = await readTokenPayload("bypass");

  if (!payload?.userId || payload.userId !== userId) {
    return false;
  }

  cookieStore.delete(PASSWORD_RECOVERY_BYPASS_COOKIE);
  return true;
}

export async function clearPasswordRecoveryCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(PASSWORD_RECOVERY_PENDING_COOKIE);
  cookieStore.delete(PASSWORD_RECOVERY_VERIFIED_COOKIE);
}

export async function clearPasswordRecoveryBypassCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(PASSWORD_RECOVERY_BYPASS_COOKIE);
}

export function clearPasswordRecoveryCookiesOnResponse(response: {
  cookies: {
    set: (
      name: string,
      value: string,
      options: { maxAge: number; path: string },
    ) => void;
  };
}) {
  response.cookies.set(PASSWORD_RECOVERY_PENDING_COOKIE, "", { maxAge: 0, path: "/" });
  response.cookies.set(PASSWORD_RECOVERY_VERIFIED_COOKIE, "", { maxAge: 0, path: "/" });
  response.cookies.set(PASSWORD_RECOVERY_BYPASS_COOKIE, "", { maxAge: 0, path: "/" });
}
