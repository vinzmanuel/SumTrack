"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type AppUserLoginRow = {
  user_id: string;
};

function getAuthFields(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  return { username, password };
}

export async function login(formData: FormData) {
  const { username, password } = getAuthFields(formData);
  const supabase = await createClient();

  const { data: appUser, error: appUserError } = await supabase
    .from("users")
    .select("user_id")
    .eq("username", username)
    .maybeSingle<AppUserLoginRow>();

  if (appUserError || !appUser?.user_id) {
    redirect("/login?error=Invalid%20username%20or%20password");
  }

  const email = `${appUser.user_id}@sumtrack.local`;
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?error=Invalid%20username%20or%20password");
  }

  redirect("/dashboard");
}
