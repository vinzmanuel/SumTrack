import "server-only";

import { and, asc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { areas, borrower_info, branch, users } from "@/db/schema";
import type {
  BorrowerAreaOption,
  BorrowerBranchOption,
  BorrowerListRow,
  BorrowersPageData,
  BorrowersStaffScope,
} from "@/app/dashboard/borrowers/types";
const BORROWERS_PAGE_SIZE = 20;

function buildAreasWhere(scope: BorrowersStaffScope): SQL | undefined {
  if (scope.roleName === "Admin") {
    return scope.selectedBranchId ? eq(areas.branch_id, scope.selectedBranchId) : undefined;
  }

  if (scope.selectedBranchId) {
    return eq(areas.branch_id, scope.selectedBranchId);
  }

  if (scope.allowedBranchIds.length > 0) {
    return inArray(areas.branch_id, scope.allowedBranchIds);
  }

  return eq(areas.area_id, -1);
}

function buildBorrowersWhere(scope: BorrowersStaffScope, selectedAreaId: number | null): SQL | undefined {
  const conditions: SQL[] = [];

  if (scope.roleName === "Admin") {
    if (scope.selectedBranchId) {
      conditions.push(eq(areas.branch_id, scope.selectedBranchId));
    }
  } else if (scope.selectedBranchId) {
    conditions.push(eq(areas.branch_id, scope.selectedBranchId));
  } else if (scope.allowedBranchIds.length > 0) {
    conditions.push(inArray(areas.branch_id, scope.allowedBranchIds));
  } else {
    conditions.push(eq(areas.area_id, -1));
  }

  if (selectedAreaId) {
    conditions.push(eq(areas.area_id, selectedAreaId));
  }

  if (scope.searchQuery) {
    const pattern = `%${scope.searchQuery}%`;
    conditions.push(
      or(
        ilike(users.company_id, pattern),
        ilike(borrower_info.first_name, pattern),
        ilike(borrower_info.last_name, pattern),
        ilike(borrower_info.middle_name, pattern),
        ilike(
          sql<string>`concat_ws(' ', ${borrower_info.first_name}, ${borrower_info.middle_name}, ${borrower_info.last_name})`,
          pattern,
        ),
      )!,
    );
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

function buildBranchesWhere(scope: BorrowersStaffScope): SQL | undefined {
  if (scope.roleName === "Admin") {
    return undefined;
  }

  if (scope.allowedBranchIds.length === 0) {
    return eq(branch.branch_id, -1);
  }

  return inArray(branch.branch_id, scope.allowedBranchIds);
}

function toBorrowerListRow(row: {
  user_id: string;
  company_id: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  area_code: string;
  branch_name: string;
  branch_code: string | null;
  contact_number: string | null;
}): BorrowerListRow {
  return {
    userId: row.user_id,
    companyId: row.company_id,
    firstName: row.first_name,
    middleName: row.middle_name,
    lastName: row.last_name,
    areaCode: row.area_code,
    branchName: row.branch_name,
    branchCode: row.branch_code,
    contactNumber: row.contact_number,
  };
}

function toBranchOption(row: { branch_id: number; branch_name: string }): BorrowerBranchOption {
  return {
    branch_id: row.branch_id,
    branch_name: row.branch_name,
  };
}

function toAreaOption(row: { area_id: number; area_code: string }): BorrowerAreaOption {
  return {
    area_id: row.area_id,
    area_code: row.area_code,
  };
}

export async function loadBorrowersPageData(scope: BorrowersStaffScope): Promise<BorrowersPageData> {
  const areasWhere = buildAreasWhere(scope);
  const branchesWhere = buildBranchesWhere(scope);
  const requestedPage = Math.max(scope.page, 1);

  const [branches, areasRows] = await Promise.all([
    scope.canChooseBranch
      ? db
          .select({
            branch_id: branch.branch_id,
            branch_name: branch.branch_name,
          })
          .from(branch)
          .where(branchesWhere)
          .orderBy(asc(branch.branch_name))
          .catch(() => [])
      : Promise.resolve([]),
    db
      .select({
        area_id: areas.area_id,
        area_code: areas.area_code,
      })
      .from(areas)
      .where(areasWhere)
      .orderBy(asc(areas.area_code))
      .catch(() => []),
  ]);

  const selectedAreaId =
    scope.requestedAreaId && areasRows.some((area) => area.area_id === scope.requestedAreaId)
      ? scope.requestedAreaId
      : null;

  const whereCondition = buildBorrowersWhere(scope, selectedAreaId);

  const totalCount = await db
    .select({ value: sql<number>`count(*)` })
    .from(borrower_info)
    .innerJoin(users, eq(users.user_id, borrower_info.user_id))
    .innerJoin(areas, eq(areas.area_id, borrower_info.area_id))
    .innerJoin(branch, eq(branch.branch_id, areas.branch_id))
    .where(whereCondition)
    .then((rows) => Number(rows[0]?.value) || 0)
    .catch(() => 0);

  const totalPages = Math.max(Math.ceil(totalCount / BORROWERS_PAGE_SIZE), 1);
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * BORROWERS_PAGE_SIZE;

  const borrowers = await db
    .select({
      user_id: borrower_info.user_id,
      company_id: users.company_id,
      first_name: borrower_info.first_name,
      middle_name: borrower_info.middle_name,
      last_name: borrower_info.last_name,
      area_code: areas.area_code,
      branch_name: branch.branch_name,
      branch_code: branch.branch_code,
      contact_number: users.contact_no,
    })
    .from(borrower_info)
    .innerJoin(users, eq(users.user_id, borrower_info.user_id))
    .innerJoin(areas, eq(areas.area_id, borrower_info.area_id))
    .innerJoin(branch, eq(branch.branch_id, areas.branch_id))
    .where(whereCondition)
    .orderBy(asc(users.company_id))
    .limit(BORROWERS_PAGE_SIZE)
    .offset(offset)
    .catch(() => []);

  return {
    branches: branches.map(toBranchOption),
    areas: areasRows.map(toAreaOption),
    borrowers: borrowers.map(toBorrowerListRow),
    selectedAreaId,
    page,
    pageSize: BORROWERS_PAGE_SIZE,
    totalCount,
  };
}
