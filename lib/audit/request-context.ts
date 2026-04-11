import { headers } from "next/headers";

export type AuditRequestContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

function firstHeaderValue(value: string | null) {
  if (!value) {
    return null;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .find(Boolean) ?? null;
}

export async function getAuditRequestContext(): Promise<AuditRequestContext> {
  try {
    const headerStore = await headers();

    return {
      ipAddress:
        firstHeaderValue(headerStore.get("x-forwarded-for")) ??
        firstHeaderValue(headerStore.get("x-real-ip")) ??
        null,
      userAgent: headerStore.get("user-agent"),
    };
  } catch {
    return {};
  }
}

export function getAuditRequestContextFromRequest(request: Request): AuditRequestContext {
  return {
    ipAddress:
      firstHeaderValue(request.headers.get("x-forwarded-for")) ??
      firstHeaderValue(request.headers.get("x-real-ip")) ??
      null,
    userAgent: request.headers.get("user-agent"),
  };
}
