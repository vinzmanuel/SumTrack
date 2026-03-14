import { db } from "@/db";
import {
  borrower_info,
  employee_area_assignment,
  employee_branch_assignment,
  employee_info,
  users,
} from "@/db/schema";
import type {
  ParsedCreateAccountInput,
  ResolvedCreateAccountScope,
  SelectedRoleContext,
} from "@/app/dashboard/create-account/action-types";
import { getErrorMessage } from "@/app/dashboard/create-account/action-validation";

type PersistParams = {
  userId: string;
  companyId: string;
  username: string;
  creatorUserId: string;
  input: ParsedCreateAccountInput;
  selectedRole: SelectedRoleContext;
  resolvedScope: ResolvedCreateAccountScope;
};

export async function persistCreateAccountRecords(params: PersistParams) {
  const now = new Date().toISOString();

  try {
    await db.insert(users).values({
      user_id: params.userId,
      company_id: params.companyId,
      username: params.username,
      role_id: params.selectedRole.roleId,
      contact_no: params.input.contactNo || null,
      email: params.input.email || null,
      status: "active",
      created_by: params.creatorUserId,
      updated_at: now,
    });
  } catch (error) {
    return {
      ok: false as const,
      message: `Failed inserting into users: ${getErrorMessage(error)}`,
    };
  }

  if (params.input.accountCategory === "Employee") {
    try {
      await db.insert(employee_info).values({
        user_id: params.userId,
        first_name: params.input.firstName,
        middle_name: params.input.middleName || null,
        last_name: params.input.lastName,
      });
    } catch (error) {
      return {
        ok: false as const,
        message: `Failed inserting into employee_info: ${getErrorMessage(error)}`,
      };
    }

    if (params.selectedRole.isCollectorRole) {
      const startDate = new Date().toISOString().slice(0, 10);
      try {
        await db.insert(employee_area_assignment).values({
          employee_user_id: params.userId,
          area_id: params.resolvedScope.selectedArea!.area_id,
          start_date: startDate,
          end_date: null,
        });
      } catch (error) {
        return {
          ok: false as const,
          message: `Failed inserting area assignment: ${getErrorMessage(error)}`,
        };
      }
    } else if (params.resolvedScope.selectedBranches.length > 0) {
      const startDate = new Date().toISOString().slice(0, 10);
      try {
        await db.insert(employee_branch_assignment).values(
          params.resolvedScope.selectedBranches.map((item) => ({
            employee_user_id: params.userId,
            branch_id: item.branch_id,
            start_date: startDate,
            end_date: null,
          })),
        );
      } catch (error) {
        return {
          ok: false as const,
          message: `Failed inserting branch assignment: ${getErrorMessage(error)}`,
        };
      }
    }
  } else {
    try {
      await db.insert(borrower_info).values({
        user_id: params.userId,
        first_name: params.input.firstName,
        middle_name: params.input.middleName || null,
        last_name: params.input.lastName,
        address: params.input.address,
        area_id: params.resolvedScope.selectedArea!.area_id,
      });
    } catch (error) {
      return {
        ok: false as const,
        message: `Failed inserting into borrower_info: ${getErrorMessage(error)}`,
      };
    }
  }

  return {
    ok: true as const,
  };
}
