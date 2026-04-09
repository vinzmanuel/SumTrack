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
import { roles, users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

function getAuthFields(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  return { username, password };
}

export async function login(formData: FormData) {
  const { username, password } = getAuthFields(formData);
  const supabase = await createClient();

  const appUser = await db
    .select({
      user_id: users.user_id,
      role_name: roles.role_name,
      contact_no: users.contact_no,
      email: users.email,
    })
    .from(users)
    .innerJoin(roles, eq(roles.role_id, users.role_id))
    .where(eq(users.username, username))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!appUser?.user_id) {
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
    redirect("/login?error=Invalid%20username%20or%20password");
  }

  const hasPostResetBypass = await consumePasswordRecoveryLoginBypass(appUser.user_id);
  await clearAdminTwoFactorCookies();

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
