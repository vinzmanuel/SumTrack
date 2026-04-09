"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { clearAdminTwoFactorCookies } from "@/lib/auth/admin-two-factor";
import { assertTwilioVerifyReady, normalizePhilippineMobileToE164 } from "@/lib/twilio/verify";
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
    try {
      assertTwilioVerifyReady();
      normalizePhilippineMobileToE164(appUser.contact_no);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Admin two-factor verification could not be started.";
      redirect(`/login?error=${encodeURIComponent(message)}`);
    }
  }

  const email = `${appUser.user_id}@sumtrack.local`;
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?error=Invalid%20username%20or%20password");
  }

  await clearAdminTwoFactorCookies();

  if (appUser.role_name === "Admin") {
    redirect("/login/verify/start");
  }

  redirect("/dashboard");
}
