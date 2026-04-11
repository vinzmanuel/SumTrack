"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import {
  clearAdminTwoFactorCookies,
  setAdminTwoFactorVerified,
} from "@/lib/auth/admin-two-factor";
import { consumePasswordRecoveryLoginBypass } from "@/lib/auth/password-recovery";
import { resolveAdminOtpChannelAvailability } from "@/lib/auth/admin-otp-channels";
import { db } from "@/db";
import { employee_info, roles, users } from "@/db/schema";
import { getAuditRequestContext } from "@/lib/audit/request-context";
import { logAuditEvent } from "@/lib/audit/logger";
import { createClient } from "@/lib/supabase/server";

function getAuthFields(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  return { username, password };
}

export async function login(formData: FormData) {
  const { username, password } = getAuthFields(formData);
  const supabase = await createClient();
  const requestContext = await getAuditRequestContext();

  const appUser = await db
    .select({
      user_id: users.user_id,
      company_id: users.company_id,
      username: users.username,
      role_name: roles.role_name,
      contact_no: users.contact_no,
      email: users.email,
      first_name: employee_info.first_name,
      middle_name: employee_info.middle_name,
      last_name: employee_info.last_name,
    })
    .from(users)
    .innerJoin(roles, eq(roles.role_id, users.role_id))
    .leftJoin(employee_info, eq(employee_info.user_id, users.user_id))
    .where(eq(users.username, username))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  const displayName =
    [appUser?.first_name, appUser?.middle_name, appUser?.last_name].filter(Boolean).join(" ") ||
    appUser?.company_id ||
    appUser?.username ||
    username;

  if (!appUser?.user_id) {
    await logAuditEvent({
      action: "auth.login_failed",
      entityType: "auth",
      entityId: username || null,
      description: `Failed login attempt for unknown username ${username || "(blank)"}.`,
      actor: {
        type: "user",
        displayName: username || "Unknown user",
      },
      metadata: {
        identifierType: "username",
        username,
        failureReason: "unknown_username",
      },
      requestContext,
    });
    redirect("/login?error=Invalid%20username%20or%20password");
  }

  if (appUser.role_name === "Admin") {
    const availability = resolveAdminOtpChannelAvailability({
      contactNo: appUser.contact_no,
      email: appUser.email,
    });

    if (availability.availableChannels.length === 0) {
      const message =
        availability.errorMessage ??
        "No OTP destination is available for this Admin account.";
      redirect(`/login?error=${encodeURIComponent(message)}`);
    }
  }

  const email = `${appUser.user_id}@sumtrack.local`;
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    await logAuditEvent({
      action: "auth.login_failed",
      entityType: "auth",
      entityId: appUser.user_id,
      description: `Failed login attempt for ${displayName}.`,
      actor: {
        type: "user",
        userId: appUser.user_id,
        companyId: appUser.company_id,
        displayName,
        roleName: appUser.role_name,
      },
      target: {
        userId: appUser.user_id,
        companyId: appUser.company_id,
        displayName,
      },
      metadata: {
        identifierType: "username",
        username,
        failureReason: "invalid_password",
      },
      requestContext,
    });
    redirect("/login?error=Invalid%20username%20or%20password");
  }

  const hasPostResetBypass = await consumePasswordRecoveryLoginBypass(appUser.user_id);
  await clearAdminTwoFactorCookies();

  await logAuditEvent({
    action: "auth.login_succeeded",
    entityType: "auth",
    entityId: appUser.user_id,
    description: `Login succeeded for ${displayName}.`,
    actor: {
      type: "user",
      userId: appUser.user_id,
      companyId: appUser.company_id,
      displayName,
      roleName: appUser.role_name,
    },
    target: {
      userId: appUser.user_id,
      companyId: appUser.company_id,
      displayName,
    },
    metadata: {
      identifierType: "username",
      username,
      otpRequired: appUser.role_name === "Admin" && !hasPostResetBypass,
      postResetBypassUsed: hasPostResetBypass,
    },
    requestContext,
  });

  if (hasPostResetBypass) {
    if (appUser.role_name === "Admin") {
      await setAdminTwoFactorVerified(appUser.user_id);
    }

    redirect("/dashboard");
  }

  if (appUser.role_name === "Admin") {
    redirect("/login/verify/start");
  }

  redirect("/dashboard");
}
