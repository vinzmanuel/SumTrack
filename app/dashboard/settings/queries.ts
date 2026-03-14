import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  areas,
  borrower_info,
  branch,
  employee_area_assignment,
  employee_branch_assignment,
  employee_info,
  roles,
  users,
} from "@/db/schema";
import type { SelfProfileDetail } from "@/app/dashboard/settings/types";

function formatFullName(firstName: string | null, middleName: string | null, lastName: string | null) {
  return [firstName, middleName, lastName].filter(Boolean).join(" ").trim() || "N/A";
}

async function loadScopeLabel(userId: string, roleName: string) {
  if (roleName === "Admin") {
    return "Global";
  }

  if (roleName === "Borrower") {
    const row = await db
      .select({ areaCode: areas.area_code })
      .from(borrower_info)
      .innerJoin(areas, eq(areas.area_id, borrower_info.area_id))
      .where(eq(borrower_info.user_id, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null);

    return row?.areaCode ?? "Unassigned";
  }

  if (roleName === "Collector") {
    const rows = await db
      .select({ areaCode: areas.area_code })
      .from(employee_area_assignment)
      .innerJoin(areas, eq(areas.area_id, employee_area_assignment.area_id))
      .where(
        and(
          eq(employee_area_assignment.employee_user_id, userId),
          isNull(employee_area_assignment.end_date),
        ),
      )
      .catch(() => []);

    const labels = Array.from(new Set(rows.map((row) => row.areaCode).filter(Boolean)));
    return labels.length > 0 ? labels.join(", ") : "Unassigned";
  }

  const rows = await db
    .select({ branchCode: branch.branch_code, branchName: branch.branch_name })
    .from(employee_branch_assignment)
    .innerJoin(branch, eq(branch.branch_id, employee_branch_assignment.branch_id))
    .where(
      and(
        eq(employee_branch_assignment.employee_user_id, userId),
        isNull(employee_branch_assignment.end_date),
      ),
    )
    .catch(() => []);

  const labels = Array.from(
    new Set(rows.map((row) => row.branchCode || row.branchName).filter(Boolean)),
  );
  return labels.length > 0 ? labels.join(", ") : "Unassigned";
}

export async function loadSelfProfile(userId: string): Promise<SelfProfileDetail | null> {
  const row = await db
    .select({
      userId: users.user_id,
      companyId: users.company_id,
      username: users.username,
      roleName: roles.role_name,
      status: users.status,
      contactNo: users.contact_no,
      email: users.email,
      dateCreated: users.date_created,
      employeeFirstName: employee_info.first_name,
      employeeMiddleName: employee_info.middle_name,
      employeeLastName: employee_info.last_name,
      borrowerFirstName: borrower_info.first_name,
      borrowerMiddleName: borrower_info.middle_name,
      borrowerLastName: borrower_info.last_name,
    })
    .from(users)
    .innerJoin(roles, eq(roles.role_id, users.role_id))
    .leftJoin(employee_info, eq(employee_info.user_id, users.user_id))
    .leftJoin(borrower_info, eq(borrower_info.user_id, users.user_id))
    .where(eq(users.user_id, userId))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!row) {
    return null;
  }

  const isBorrower = row.roleName === "Borrower";
  const firstName = isBorrower ? row.borrowerFirstName : row.employeeFirstName;
  const middleName = isBorrower ? row.borrowerMiddleName : row.employeeMiddleName;
  const lastName = isBorrower ? row.borrowerLastName : row.employeeLastName;
  const fullName = formatFullName(
    firstName,
    middleName,
    lastName,
  );
  const scopeLabel = await loadScopeLabel(userId, row.roleName);

  return {
    userId: row.userId,
    fullName,
    firstName: firstName ?? "",
    middleName: middleName ?? "",
    lastName: lastName ?? "",
    companyId: row.companyId,
    username: row.username,
    roleName: row.roleName,
    status: row.status,
    scopeLabel,
    contactNo: row.contactNo,
    email: row.email,
    dateCreated: row.dateCreated,
  };
}

export async function updateSelfProfileDetails(params: {
  userId: string;
  roleName: string;
  firstName: string;
  middleName: string;
  lastName: string;
  contactNo: string | null;
  email: string | null;
}) {
  try {
    await db
      .update(users)
      .set({
        contact_no: params.contactNo,
        email: params.email,
        updated_at: new Date().toISOString(),
      })
      .where(eq(users.user_id, params.userId));

    if (params.roleName === "Borrower") {
      await db
        .update(borrower_info)
        .set({
          first_name: params.firstName,
          middle_name: params.middleName || null,
          last_name: params.lastName,
        })
        .where(eq(borrower_info.user_id, params.userId));
    } else {
      await db
        .update(employee_info)
        .set({
          first_name: params.firstName,
          middle_name: params.middleName || null,
          last_name: params.lastName,
        })
        .where(eq(employee_info.user_id, params.userId));
    }

    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return { ok: false as const, message: `Unable to update account details: ${message}` };
  }
}

export async function updateSelfUsername(params: { userId: string; username: string }) {
  try {
    await db
      .update(users)
      .set({
        username: params.username,
        updated_at: new Date().toISOString(),
      })
      .where(eq(users.user_id, params.userId));

    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    if (message.toLowerCase().includes("users_username_key")) {
      return { ok: false as const, message: "Username is already in use." };
    }

    return { ok: false as const, message: `Unable to update username: ${message}` };
  }
}
