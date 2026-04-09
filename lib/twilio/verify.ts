import "server-only";

type TwilioVerifyResponse = {
  status?: string;
  message?: string;
};

function getTwilioVerifyConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !serviceSid) {
    throw new Error("Twilio Verify is not fully configured.");
  }

  return { accountSid, authToken, serviceSid };
}

export function normalizePhilippineMobileToE164(contactNo: string | null | undefined) {
  const normalized = String(contactNo ?? "").trim();

  if (!/^09\d{9}$/.test(normalized)) {
    throw new Error(
      "The Admin contact number must be a valid Philippine mobile number in 09XXXXXXXXX format.",
    );
  }

  return `+63${normalized.slice(1)}`;
}

export function maskPhilippineMobile(contactNo: string | null | undefined) {
  const normalized = String(contactNo ?? "").trim();
  if (!/^09\d{9}$/.test(normalized)) {
    return "your registered mobile number";
  }

  return `${normalized.slice(0, 4)}••••${normalized.slice(-3)}`;
}

async function postTwilioVerify(
  path: string,
  body: Record<string, string>,
): Promise<TwilioVerifyResponse> {
  const { accountSid, authToken, serviceSid } = getTwilioVerifyConfig();
  const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const response = await fetch(
    `https://verify.twilio.com/v2/Services/${serviceSid}/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(body),
      cache: "no-store",
    },
  );

  const payload = (await response.json().catch(() => null)) as TwilioVerifyResponse | null;

  if (!response.ok) {
    throw new Error(payload?.message || "Unable to contact Twilio Verify right now.");
  }

  return payload ?? {};
}

export async function startSmsVerification(localContactNo: string | null | undefined) {
  const to = normalizePhilippineMobileToE164(localContactNo);
  return postTwilioVerify("Verifications", { To: to, Channel: "sms" });
}

export async function checkSmsVerificationCode(
  localContactNo: string | null | undefined,
  code: string,
) {
  const normalizedCode = code.replace(/\D/g, "").trim();

  if (normalizedCode.length < 4 || normalizedCode.length > 10) {
    throw new Error("Enter a valid verification code.");
  }

  const to = normalizePhilippineMobileToE164(localContactNo);
  const payload = await postTwilioVerify("VerificationCheck", {
    To: to,
    Code: normalizedCode,
  });

  return {
    approved: payload.status === "approved",
    status: payload.status ?? "unknown",
  };
}

export function assertTwilioVerifyReady() {
  getTwilioVerifyConfig();
}
