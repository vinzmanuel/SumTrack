import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { AdminOtpChannel } from "@/lib/auth/admin-otp-channels";

const ADMIN_2FA_PENDING_COOKIE = "sumtrack_admin_2fa_pending";
const ADMIN_2FA_VERIFIED_COOKIE = "sumtrack_admin_2fa_verified";
const ADMIN_2FA_PENDING_MAX_AGE_SECONDS = 60 * 10;
const ADMIN_2FA_VERIFIED_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

type AdminTwoFactorTokenPurpose = "pending" | "verified";

type AdminTwoFactorTokenPayload = {
  userId: string;
  purpose: AdminTwoFactorTokenPurpose;
  issuedAt: number;
  expiresAt: number;
  channel?: AdminOtpChannel;
  emailCodeHash?: string | null;
};

function getAdminTwoFactorSigningSecret() {
  const secret = process.env.TWILIO_AUTH_TOKEN;
  if (!secret) {
    throw new Error("Missing Twilio 2FA configuration.");
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

function encodePayload(payload: AdminTwoFactorTokenPayload) {
  const serialized = JSON.stringify(payload);
  return Buffer.from(serialized, "utf8").toString("base64url");
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", getAdminTwoFactorSigningSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function createSignedToken(payload: AdminTwoFactorTokenPayload) {
  const encodedPayload = encodePayload(payload);
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function decodeSignedToken(
  token: string | undefined,
  expectedPurpose: AdminTwoFactorTokenPurpose,
) {
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
    const decoded = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const payload = JSON.parse(decoded) as AdminTwoFactorTokenPayload;

    if (
      payload.purpose !== expectedPurpose ||
      typeof payload.userId !== "string" ||
      typeof payload.issuedAt !== "number" ||
      typeof payload.expiresAt !== "number"
    ) {
      return null;
    }

    if (payload.expiresAt <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

async function readTokenPayload(expectedPurpose: AdminTwoFactorTokenPurpose) {
  const cookieStore = await cookies();
  const cookieName =
    expectedPurpose === "pending"
      ? ADMIN_2FA_PENDING_COOKIE
      : ADMIN_2FA_VERIFIED_COOKIE;

  return decodeSignedToken(cookieStore.get(cookieName)?.value, expectedPurpose);
}

function hashOtpCode(code: string) {
  return createHmac("sha256", getAdminTwoFactorSigningSecret())
    .update(code)
    .digest("base64url");
}

export async function hasAdminTwoFactorPendingChallenge(userId: string) {
  const payload = await readTokenPayload("pending");
  return payload?.userId === userId;
}

export async function getAdminTwoFactorPendingChallenge(userId: string) {
  const payload = await readTokenPayload("pending");
  if (!payload || payload.userId !== userId) {
    return null;
  }

  return {
    channel: payload.channel ?? null,
    emailCodeHash: payload.emailCodeHash ?? null,
    expiresAt: payload.expiresAt,
  };
}

export async function hasVerifiedAdminTwoFactor(userId: string) {
  const payload = await readTokenPayload("verified");
  return payload?.userId === userId;
}

export async function setAdminTwoFactorPendingChallenge(
  userId: string,
  options?: {
    channel?: AdminOtpChannel;
    emailCode?: string | null;
  },
) {
  const cookieStore = await cookies();
  const now = Date.now();

  cookieStore.set(
    ADMIN_2FA_PENDING_COOKIE,
    createSignedToken({
      userId,
      purpose: "pending",
      issuedAt: now,
      expiresAt: now + ADMIN_2FA_PENDING_MAX_AGE_SECONDS * 1000,
      channel: options?.channel,
      emailCodeHash: options?.emailCode ? hashOtpCode(options.emailCode) : null,
    }),
    getCookieOptions(ADMIN_2FA_PENDING_MAX_AGE_SECONDS),
  );
  cookieStore.delete(ADMIN_2FA_VERIFIED_COOKIE);
}

export async function verifyPendingAdminEmailOtpCode(userId: string, code: string) {
  const pending = await getAdminTwoFactorPendingChallenge(userId);
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

export async function setAdminTwoFactorVerified(userId: string) {
  const cookieStore = await cookies();
  const now = Date.now();

  cookieStore.set(
    ADMIN_2FA_VERIFIED_COOKIE,
    createSignedToken({
      userId,
      purpose: "verified",
      issuedAt: now,
      expiresAt: now + ADMIN_2FA_VERIFIED_MAX_AGE_SECONDS * 1000,
    }),
    getCookieOptions(ADMIN_2FA_VERIFIED_MAX_AGE_SECONDS),
  );
  cookieStore.delete(ADMIN_2FA_PENDING_COOKIE);
}

export async function clearAdminTwoFactorCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_2FA_PENDING_COOKIE);
  cookieStore.delete(ADMIN_2FA_VERIFIED_COOKIE);
}

export function clearAdminTwoFactorCookiesOnResponse(response: {
  cookies: {
    set: (
      name: string,
      value: string,
      options: { maxAge: number; path: string },
    ) => void;
  };
}) {
  response.cookies.set(ADMIN_2FA_PENDING_COOKIE, "", { maxAge: 0, path: "/" });
  response.cookies.set(ADMIN_2FA_VERIFIED_COOKIE, "", { maxAge: 0, path: "/" });
}

export function getAdminTwoFactorCookieNames() {
  return {
    pending: ADMIN_2FA_PENDING_COOKIE,
    verified: ADMIN_2FA_VERIFIED_COOKIE,
  };
}
