import { NextResponse } from "next/server";
import { clearAdminTwoFactorCookiesOnResponse } from "@/lib/auth/admin-two-factor";
import { clearPasswordRecoveryCookiesOnResponse } from "@/lib/auth/password-recovery";
import { createClient } from "@/lib/supabase/server";

function resolvePostLogoutRedirect(request: Request, value: string | null) {
  if (!value) {
    return new URL("/login", request.url);
  }

  if (value === "/" || value === "/login") {
    return new URL(value, request.url);
  }

  return new URL("/login", request.url);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const formData = await request.formData().catch(() => null);
  const redirectTo = resolvePostLogoutRedirect(
    request,
    typeof formData?.get("redirectTo") === "string" ? String(formData?.get("redirectTo")) : null,
  );

  const response = NextResponse.redirect(redirectTo);
  clearAdminTwoFactorCookiesOnResponse(response);
  clearPasswordRecoveryCookiesOnResponse(response);
  return response;
}
