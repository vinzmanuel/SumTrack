"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import {
  parseManageUserAccountsFilters,
  resolveManageUserAccountsAccess,
} from "@/app/dashboard/manage-user-accounts/filters";
import { updateManagedUserAccount } from "@/app/dashboard/manage-user-accounts/queries";

export type EditManagedUserState = {
  status: "idle" | "error";
  message: string;
};

export const initialEditManagedUserState: EditManagedUserState = {
  status: "idle",
  message: "",
};

export async function updateManagedUserAccountAction(
  _previousState: EditManagedUserState,
  formData: FormData,
): Promise<EditManagedUserState> {
  const auth = await getDashboardAuthContext();
  const accessState = resolveManageUserAccountsAccess(
    auth,
    parseManageUserAccountsFilters({}),
  );

  if (accessState.view !== "staff") {
    return {
      status: "error",
      message: "You are not authorized to edit user accounts.",
    };
  }

  const userId = String(formData.get("user_id") ?? "").trim();
  const roleIdRaw = String(formData.get("role_id") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const firstName = String(formData.get("first_name") ?? "").trim();
  const middleName = String(formData.get("middle_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const contactNo = String(formData.get("contact_no") ?? "").trim();

  if (!userId || !firstName || !lastName) {
    return {
      status: "error",
      message: "First name and last name are required.",
    };
  }

  const result = await updateManagedUserAccount({
    scope: accessState,
    userId,
    roleId: /^\d+$/.test(roleIdRaw) ? Number(roleIdRaw) : null,
    email,
    firstName,
    middleName,
    lastName,
    contactNo,
  });

  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
    };
  }

  revalidatePath("/dashboard/manage-user-accounts");
  revalidatePath(`/dashboard/manage-user-accounts/${userId}`);
  redirect(`/dashboard/manage-user-accounts/${userId}`);
}
