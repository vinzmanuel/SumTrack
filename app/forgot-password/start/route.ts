import { NextResponse } from "next/server";
import { startPasswordRecoveryChallenge } from "@/app/forgot-password/helpers";
import { getAuditRequestContextFromRequest } from "@/lib/audit/request-context";

function buildRedirect(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const identifier = String(formData.get("identifier") ?? "");

    await startPasswordRecoveryChallenge(identifier, getAuditRequestContextFromRequest(request));
    return buildRedirect(request, "/forgot-password/verify?sent=1");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to start password recovery.";
    return buildRedirect(request, `/forgot-password?error=${encodeURIComponent(message)}`);
  }
}
