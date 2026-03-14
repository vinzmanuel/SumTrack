"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import {
  isValidEmailAddress,
  isValidPhilippineMobile,
  normalizeAccountContactNo,
  normalizeAccountEmail,
} from "@/app/dashboard/account-field-validation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { updateSelfProfileDetails, updateSelfUsername } from "@/app/dashboard/settings/queries";
import type { SettingsFormState } from "@/app/dashboard/settings/state";

function createPasswordVerificationClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createSupabaseClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export async function updateSelfAccountDetailsAction(
  _previousState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const auth = await getDashboardAuthContext();

  if (!auth.ok) {
    return {
      status: "error",
      message: "You must be logged in to update your profile.",
    };
  }

  const firstName = String(formData.get("first_name") ?? "").trim().slice(0, 100);
  const middleName = String(formData.get("middle_name") ?? "").trim().slice(0, 100);
  const lastName = String(formData.get("last_name") ?? "").trim().slice(0, 100);
  const contactNoRaw = String(formData.get("contact_no") ?? "");
  const emailRaw = String(formData.get("email") ?? "");
  const contactNo = normalizeAccountContactNo(contactNoRaw);
  const email = normalizeAccountEmail(emailRaw);
  const requiresContactNo = auth.roleName === "Borrower" || auth.roleName === "Collector";

  if (!firstName) {
    return {
      status: "error",
      message: "First name is required.",
    };
  }

  if (!lastName) {
    return {
      status: "error",
      message: "Last name is required.",
    };
  }

  if (requiresContactNo && !contactNo) {
    return {
      status: "error",
      message: "Contact number is required for your account.",
    };
  }

  if (contactNo && !isValidPhilippineMobile(contactNo)) {
    return {
      status: "error",
      message: "Enter a valid PH mobile number starting with 09.",
    };
  }

  if (email && !isValidEmailAddress(email)) {
    return {
      status: "error",
      message: "Enter a valid email address.",
    };
  }

  const result = await updateSelfProfileDetails({
    userId: auth.userId,
    roleName: auth.roleName,
    firstName,
    middleName,
    lastName,
    contactNo: contactNo || null,
    email: email || null,
  });

  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
    };
  }

  revalidatePath("/dashboard/my-profile");
  revalidatePath("/dashboard/settings");
  return {
    status: "success",
    message: "Account information updated.",
  };
}

export async function updateSelfUsernameAction(
  _previousState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const auth = await getDashboardAuthContext();

  if (!auth.ok) {
    return {
      status: "error",
      message: "You must be logged in to update your username.",
    };
  }

  const username = String(formData.get("username") ?? "").trim().slice(0, 80);
  if (!username) {
    return {
      status: "error",
      message: "Username is required.",
    };
  }

  const result = await updateSelfUsername({
    userId: auth.userId,
    username,
  });

  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
    };
  }

  revalidatePath("/dashboard/my-profile");
  revalidatePath("/dashboard/settings");
  return {
    status: "success",
    message: "Username updated.",
  };
}

export async function updateSelfPasswordAction(
  _previousState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const auth = await getDashboardAuthContext();

  if (!auth.ok) {
    return {
      status: "error",
      message: "You must be logged in to change your password.",
    };
  }

  const currentPassword = String(formData.get("current_password") ?? "");
  const nextPassword = String(formData.get("new_password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!currentPassword || !nextPassword || !confirmPassword) {
    return {
      status: "error",
      message: "Fill in all password fields.",
    };
  }

  if (nextPassword.length < 8) {
    return {
      status: "error",
      message: "New password must be at least 8 characters long.",
    };
  }

  if (currentPassword === nextPassword) {
    return {
      status: "error",
      message: "New password must be different from your current password.",
    };
  }

  if (nextPassword !== confirmPassword) {
    return {
      status: "error",
      message: "New password and confirmation do not match.",
    };
  }

  try {
    const verifyClient = createPasswordVerificationClient();
    const internalEmail = `${auth.userId}@sumtrack.local`;
    const { error: verifyError } = await verifyClient.auth.signInWithPassword({
      email: internalEmail,
      password: currentPassword,
    });

    if (verifyError) {
      return {
        status: "error",
        message: "Current password is incorrect.",
      };
    }

    await verifyClient.auth.signOut();

    const supabase = await createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: nextPassword,
    });

    if (updateError) {
      return {
        status: "error",
        message: updateError.message || "Unable to update password right now.",
      };
    }

    await db
      .update(users)
      .set({
        updated_at: new Date().toISOString(),
      })
      .where(eq(users.user_id, auth.userId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return {
      status: "error",
      message: `Unable to update password: ${message}`,
    };
  }

  revalidatePath("/dashboard/my-profile");
  revalidatePath("/dashboard/settings");
  return {
    status: "success",
    message: "Password updated.",
  };
}
