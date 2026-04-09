import { NextResponse } from "next/server";
import { startAdminVerificationChallenge } from "@/app/login/verify/helpers";

export async function GET(request: Request) {
  try {
    const result = await startAdminVerificationChallenge();
    if (result.needsChoice) {
      return NextResponse.redirect(new URL("/login/verify?choose=1", request.url));
    }

    return NextResponse.redirect(
      new URL(`/login/verify?sent=1&channel=${encodeURIComponent(result.channel)}`, request.url),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to send the verification code.";
    return NextResponse.redirect(
      new URL(`/login/verify?error=${encodeURIComponent(message)}`, request.url),
    );
  }
}
