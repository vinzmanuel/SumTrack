import "server-only";

import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { resolveCreateLoanAccess } from "@/app/dashboard/create-loan/access";
import { ACTIVE_LOAN_STATUSES } from "@/app/dashboard/loans/active-statuses";
import { db } from "@/db";
import {
  areas,
  borrower_info,
  branch,
  employee_area_assignment,
  employee_info,
  loan_records,
  roles,
  users,
} from "@/db/schema";
import type {
  AreaOption,
  BorrowerOption,
  BranchOption,
  CollectorOption,
  CreateLoanPageState,
  PrefilledBorrower,
} from "@/app/dashboard/create-loan/types";

function buildBorrowerLabel(
  firstName: string | null,
  lastName: string | null,
  companyId: string | null,
  username: string | null,
  userId: string,
) {
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (fullName) {
    return `${fullName}${companyId ? ` (${companyId})` : username ? ` (${username})` : ""}`;
  }
  if (companyId) {
    return `${companyId} (${userId})`;
  }
  if (username) {
    return `${username} (${userId})`;
  }
  return userId;
}

function buildCollectorLabel(
  firstName: string | null,
  lastName: string | null,
  username: string | null,
  userId: string,
) {
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  if (fullName) {
    return `${fullName}${username ? ` (${username})` : ""}`;
  }
  return username || userId;
}

function resolvePrefilledBorrower(
  requestedBorrowerId: string,
  borrowers: BorrowerOption[],
  areaById: Map<string, AreaOption>,
): PrefilledBorrower | null {
  if (!requestedBorrowerId) {
    return null;
  }

  const borrower = borrowers.find((item) => item.user_id === requestedBorrowerId);
  if (!borrower) {
    return null;
  }

  const borrowerArea = areaById.get(String(borrower.area_id));
  if (!borrowerArea) {
    return null;
  }

  return {
    borrowerId: borrower.user_id,
    branchId: String(borrowerArea.branch_id),
    areaId: String(borrowerArea.area_id),
    label: borrower.label,
  };
}

export async function loadCreateLoanPageData(
  requestedBorrowerId: string,
): Promise<CreateLoanPageState> {
  const access = await resolveCreateLoanAccess();

  if (!access.ok) {
    if (access.reason === "not_logged_in") {
      return { status: "not_logged_in" };
    }
    if (access.reason === "branch_assignment_required") {
      return { status: "branch_assignment_required" };
    }
    return { status: "forbidden" };
  }

  const branchFilter = access.fixedBranchId !== null ? eq(branch.branch_id, access.fixedBranchId) : undefined;
  const areaBranchFilter = access.fixedBranchId !== null ? eq(areas.branch_id, access.fixedBranchId) : undefined;
  const loanBranchFilter =
    access.fixedBranchId !== null ? eq(loan_records.branch_id, access.fixedBranchId) : undefined;

  const [branchRows, areaRows, borrowerRows, collectorRows, activeLoanRows] = await Promise.all([
    db
      .select({
        branch_id: branch.branch_id,
        branch_name: branch.branch_name,
      })
      .from(branch)
      .where(branchFilter)
      .orderBy(asc(branch.branch_name))
      .catch(() => []),
    db
      .select({
        area_id: areas.area_id,
        branch_id: areas.branch_id,
        area_no: areas.area_no,
        area_code: areas.area_code,
      })
      .from(areas)
      .where(areaBranchFilter)
      .orderBy(asc(areas.area_code))
      .catch(() => []),
    db
      .select({
        user_id: borrower_info.user_id,
        area_id: borrower_info.area_id,
        first_name: borrower_info.first_name,
        last_name: borrower_info.last_name,
        company_id: users.company_id,
        username: users.username,
      })
      .from(borrower_info)
      .innerJoin(users, eq(users.user_id, borrower_info.user_id))
      .innerJoin(areas, eq(areas.area_id, borrower_info.area_id))
      .where(areaBranchFilter)
      .orderBy(
        asc(borrower_info.first_name),
        asc(borrower_info.last_name),
        asc(users.company_id),
      )
      .catch(() => []),
    db
      .select({
        user_id: users.user_id,
        area_id: employee_area_assignment.area_id,
        username: users.username,
        first_name: employee_info.first_name,
        last_name: employee_info.last_name,
      })
      .from(employee_area_assignment)
      .innerJoin(areas, eq(areas.area_id, employee_area_assignment.area_id))
      .innerJoin(users, eq(users.user_id, employee_area_assignment.employee_user_id))
      .innerJoin(roles, eq(roles.role_id, users.role_id))
      .leftJoin(employee_info, eq(employee_info.user_id, users.user_id))
      .where(
        and(
          eq(roles.role_name, "Collector"),
          isNull(employee_area_assignment.end_date),
          areaBranchFilter,
        ),
      )
      .orderBy(
        asc(employee_info.last_name),
        asc(employee_info.first_name),
        asc(users.username),
      )
      .catch(() => []),
    db
      .select({
        borrower_id: loan_records.borrower_id,
      })
      .from(loan_records)
      .where(
        and(
          loanBranchFilter,
          inArray(loan_records.status, [...ACTIVE_LOAN_STATUSES]),
        ),
      )
      .groupBy(loan_records.borrower_id)
      .catch(() => []),
  ]);

  const branches: BranchOption[] = branchRows.map((item) => ({
    branch_id: item.branch_id,
    branch_name: item.branch_name,
  }));

  const areasData: AreaOption[] = areaRows.map((item) => ({
    area_id: item.area_id,
    branch_id: item.branch_id,
    area_no: item.area_no,
    area_code: item.area_code,
  }));

  const borrowers: BorrowerOption[] = borrowerRows.map((item) => ({
    user_id: item.user_id,
    area_id: item.area_id,
    company_id: item.company_id,
    username: item.username,
    first_name: item.first_name,
    last_name: item.last_name,
    full_name: [item.first_name, item.last_name].filter(Boolean).join(" ").trim() || item.user_id,
    label: buildBorrowerLabel(
      item.first_name,
      item.last_name,
      item.company_id,
      item.username,
      item.user_id,
    ),
  }));

  const collectors: CollectorOption[] = collectorRows.map((item) => ({
    user_id: item.user_id,
    area_id: item.area_id,
    label: buildCollectorLabel(item.first_name, item.last_name, item.username, item.user_id),
  }));

  const areaById = new Map(areasData.map((item) => [String(item.area_id), item]));

  return {
    status: "ready",
    isAdmin: access.isAdmin,
    branches,
    areas: areasData,
    borrowers,
    collectors,
    activeLoanBorrowerIds: activeLoanRows.map((item) => item.borrower_id),
    prefilledBorrower: resolvePrefilledBorrower(requestedBorrowerId, borrowers, areaById),
  };
}
