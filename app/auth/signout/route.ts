import { NextResponse } from "next/server";
import { getAuthenticatedAppContext } from "@/app/dashboard/auth";
import { clearAdminTwoFactorCookiesOnResponse } from "@/lib/auth/admin-two-factor";
import { clearPasswordRecoveryCookiesOnResponse } from "@/lib/auth/password-recovery";
import { buildAuditActorFromAuth, logAuditEvent } from "@/lib/audit/logger";
import { getAuditRequestContextFromRequest } from "@/lib/audit/request-context";
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
  const auth = await getAuthenticatedAppContext();
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

  if (auth.ok) {
    await logAuditEvent({
      action: "auth.logout",
      entityType: "auth",
      entityId: auth.userId,
      actor: buildAuditActorFromAuth(auth),
      target: {
        userId: auth.userId,
        companyId: auth.companyId,
        displayName: auth.displayName,
      },
      description: `${auth.displayName} signed out.`,
      branchId: auth.activeBranchId,
      branchScope: auth.assignedBranchIds,
      requestContext: getAuditRequestContextFromRequest(request),
      metadata: {
        redirectTo: redirectTo.pathname,
      },
    });
  }

  return response;
}
