import "server-only";

import { randomInt } from "node:crypto";

type ResendSendEmailResponse = {
  message?: string;
};

const EMAIL_OTP_LENGTH = 6;
const DEFAULT_EMAIL_LOGO_URL =
  "https://vqxvxohnwgervppjtvpw.supabase.co/storage/v1/object/public/sumtrack%20logo/SUMTRACK%20LOGO%20AND%20TEXT.png";

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    throw new Error("Resend Email OTP is not fully configured.");
  }

  return { apiKey, fromEmail };
}

export function normalizeOtpEmail(email: string | null | undefined) {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("The email address is invalid.");
  }

  return normalized;
}

export function maskOtpEmail(email: string | null | undefined) {
  try {
    const normalized = normalizeOtpEmail(email);
    const [localPart, domain] = normalized.split("@");
    if (localPart.length <= 2) {
      return `${localPart.charAt(0) || "*"}***@${domain}`;
    }

    return `${localPart.slice(0, 2)}***@${domain}`;
  } catch {
    return "your registered email address";
  }
}

export function assertResendReady() {
  getResendConfig();
}

function resolvePublicAppBaseUrl() {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL;
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, "");
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/+$/, "")}`;
  }

  return null;
}

function getEmailLogoUrl() {
  if (process.env.SUMTRACK_EMAIL_LOGO_URL) {
    return process.env.SUMTRACK_EMAIL_LOGO_URL;
  }

  const baseUrl = resolvePublicAppBaseUrl();
  if (!baseUrl) {
    return DEFAULT_EMAIL_LOGO_URL;
  }

  return `${baseUrl}/Logo/${encodeURIComponent("SUMTRACK LOGO AND TEXT.png")}`;
}

export function generateEmailOtpCode() {
  return randomInt(0, 10 ** EMAIL_OTP_LENGTH)
    .toString()
    .padStart(EMAIL_OTP_LENGTH, "0");
}

export async function sendEmailOtpCode(
  email: string | null | undefined,
  code: string,
  options?: {
    subject?: string;
    introText?: string;
  },
) {
  const to = normalizeOtpEmail(email);
  const { apiKey, fromEmail } = getResendConfig();
  const subject = options?.subject ?? "SumTrack verification code";
  const introText =
    options?.introText ?? "Your SumTrack verification code is:";
  const logoUrl = getEmailLogoUrl();
  const html = `
    <!doctype html>
    <html>
      <body style="margin:0; padding:0; background-color:#ffffff; color:#111827; font-family:Inter, Arial, Helvetica, sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse; background-color:#ffffff;">
          <tr>
            <td align="center" style="padding:32px 16px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse; max-width:560px;">
                ${
                  logoUrl
                    ? `
                <tr>
                  <td align="left" style="padding:0 0 32px;">
                    <img src="${logoUrl}" alt="SumTrack" width="220" style="display:block; width:250px; max-width:100%; height:auto; border:0; outline:none; text-decoration:none;" />
                  </td>
                </tr>`
                    : ""
                }
                <tr>
                  <td align="left" style="padding:0 0 14px; font-size:24px; line-height:1.2; font-weight:600; color:#111827;">
                    Please verify your identity
                  </td>
                </tr>
                <tr>
                  <td align="left" style="padding:0 0 18px; font-size:16px; line-height:27px; color:#111827;">
                    ${introText}
                  </td>
                </tr>
                <tr>
                  <td align="left" style="padding:8px 0 24px; font-size:36px; line-height:40px; font-weight:600; letter-spacing:0.22em; color:#111827;">
                    <span style="display:inline-block; padding-left:0.32em; color:#111827;">${code}</span>
                  </td>
                </tr>
                <tr>
                  <td align="left" style="padding:0 0 10px; font-size:15px; line-height:26px; color:#111827;">
                    This code is valid for only <strong>10 minutes</strong>.
                  </td>
                </tr>
                <tr>
                  <td align="left" style="padding:0 0 24px; font-size:15px; line-height:26px; color:#111827;">
                    <strong>Please don't share this code with anyone.</strong>
                  </td>
                </tr>
                <tr>
                  <td align="left" style="padding:0; font-size:15px; line-height:26px; color:#111827;">
                    Thanks, <br> SumTrack Team
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to,
      subject,
      text: `Please verify your identity\n\n${introText} ${code}\n\nThis code is valid for only 10 minutes.\nPlease don't share this code with anyone.\n\nThanks, SumTrack Team`,
      html,
    }),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as ResendSendEmailResponse | null;

  if (!response.ok) {
    throw new Error(payload?.message || "Unable to send the Email OTP right now.");
  }
}
