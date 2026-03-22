import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { resolveReportsPageAccess } from "@/app/dashboard/reports/access";
import {
  generatePreviousMonthSystemReports,
  runScheduledPreviousMonthSystemReports,
} from "@/app/dashboard/reports/queries";

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

  const configuredSecret = process.env.REPORTS_SYSTEM_CRON_SECRET?.trim();
  if (!configuredSecret) {
    return {
      kind: "invalid" as const,
      status: 500,
      message:
        "REPORTS_SYSTEM_CRON_SECRET must be configured before scheduled monthly report automation can run.",
    };
  }

  const providedSecret = authorizationHeader.replace(/^Bearer\s+/i, "").trim();
  if (!providedSecret || !isValidCronSecret(providedSecret, configuredSecret)) {
    return {
      kind: "invalid" as const,
      status: 401,
      message: "Invalid automation authorization for monthly system report generation.",
    };
  }

  return { kind: "authorized" as const };
}

export async function POST(request: Request) {
  const cronAuthorization = resolveCronAuthorization(request);
  if (cronAuthorization.kind === "authorized") {
    const result = await runScheduledPreviousMonthSystemReports();

    if (!result.ok) {
      return NextResponse.json(
        {
          message: result.message,
        },
        { status: 400 },
      );
    }

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
  const access = resolveReportsPageAccess(auth);

  if (access.view !== "ready") {
    return NextResponse.json(
      {
        message:
          access.view === "unauthenticated"
            ? access.message
            : "You are not authorized to trigger monthly system-generated reports.",
      },
      { status: access.view === "unauthenticated" ? 401 : 403 },
    );
  }

  if (access.roleName !== "Admin") {
    return NextResponse.json(
      {
        message: "Only Admin users can trigger monthly system-generated reports.",
      },
      { status: 403 },
    );
  }

  const result = await generatePreviousMonthSystemReports(access);

  if (!result.ok) {
    return NextResponse.json(
      {
        message: result.message,
      },
      { status: 400 },
    );
  }

  return NextResponse.json(result, { status: 200 });
}
