import { NextResponse } from "next/server";
import { resendPasswordRecoveryChallenge } from "@/app/forgot-password/helpers";

function buildRedirect(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function POST(request: Request) {
  try {
    await resendPasswordRecoveryChallenge();
    return buildRedirect(request, "/forgot-password/verify?resent=1");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to resend the recovery code.";
    return buildRedirect(
      request,
      `/forgot-password/verify?error=${encodeURIComponent(message)}`,
    );
  }
}
