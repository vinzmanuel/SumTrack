import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { reconcileAllPersistedLoanStatuses } from "@/app/dashboard/loans/loan-status-persistence";

function isValidCronSecret(providedSecret: string, configuredSecret: string) {
  const providedBuffer = Buffer.from(providedSecret, "utf8");
  const configuredBuffer = Buffer.from(configuredSecret, "utf8");

  if (providedBuffer.length !== configuredBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, configuredBuffer);
}

function resolveCronAuthorization(request: Request) {
  const authorizationHeader = request.headers.get("authorization");
  if (!authorizationHeader || !/^Bearer\s+/i.test(authorizationHeader)) {
    return { kind: "none" as const };
  }

  const configuredSecret = process.env.LOAN_STATUS_CRON_SECRET?.trim();
  if (!configuredSecret) {
    return {
      kind: "invalid" as const,
      status: 500,
      message:
        "LOAN_STATUS_CRON_SECRET must be configured before scheduled loan status reconciliation can run.",
    };
  }

  const providedSecret = authorizationHeader.replace(/^Bearer\s+/i, "").trim();
  if (!providedSecret || !isValidCronSecret(providedSecret, configuredSecret)) {
    return {
      kind: "invalid" as const,
      status: 401,
      message: "Invalid automation authorization for loan status reconciliation.",
    };
  }

  return { kind: "authorized" as const };
}

export async function POST(request: Request) {
  const cronAuthorization = resolveCronAuthorization(request);
  if (cronAuthorization.kind === "authorized") {
    const result = await reconcileAllPersistedLoanStatuses();
    return NextResponse.json(result, { status: 200 });
  }

  if (cronAuthorization.kind === "invalid") {
    return NextResponse.json(
      {
        message: cronAuthorization.message,
      },
      { status: cronAuthorization.status },
    );
  }

  const auth = await getDashboardAuthContext();
  if (!auth.ok) {
    return NextResponse.json(
      {
        message: auth.reason === "unauthenticated" ? "You must be logged in." : auth.message,
      },
      { status: auth.reason === "unauthenticated" ? 401 : 403 },
    );
  }

  if (auth.roleName !== "Admin") {
    return NextResponse.json(
      {
        message: "Only Admin users can trigger loan status reconciliation.",
      },
      { status: 403 },
    );
  }

  const result = await reconcileAllPersistedLoanStatuses();
  return NextResponse.json(result, { status: 200 });
}
