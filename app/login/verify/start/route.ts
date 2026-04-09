import { NextResponse } from "next/server";
import { startAdminVerificationChallenge } from "@/app/login/verify/helpers";

export async function GET(request: Request) {
  try {
    await startAdminVerificationChallenge();
    return NextResponse.redirect(new URL("/login/verify?sent=1", request.url));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to send the verification code.";
    return NextResponse.redirect(
      new URL(`/login/verify?error=${encodeURIComponent(message)}`, request.url),
    );
  }
}
