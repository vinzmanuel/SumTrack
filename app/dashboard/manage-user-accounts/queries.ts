import "server-only";

import { and, asc, eq, ilike, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  areas,
  borrower_docs,
  borrower_info,
  branch,
  collections,
  employee_area_assignment,
  employee_branch_assignment,
  employee_info,
  expenses,
  incentive_payout_batches,
  incentive_payout_history,
  incentive_rules,
  loan_docs,
  loan_records,
  roles,
  users,
} from "@/db/schema";
import {
  canManageManagedUserStatus,
  canDeleteManagedUser,
  canEditManagedUser,
  type ManageUserAccountsPageData,
  type ManageUserAccountsScope,
  type ManagedUserAreaOption,
  type ManagedUserBranchOption,
  type ManagedUserDetail,
  type ManagedUserListRow,
  type ManagedUserRoleOption,
} from "@/app/dashboard/manage-user-accounts/types";
import { deleteAuthUserSafely } from "@/app/dashboard/create-account/action-identifiers";

const MANAGE_USERS_PAGE_SIZE = 20;

function formatFullName(firstName: string | null, middleName: string | null, lastName: string | null) {
  return [firstName, middleName, lastName].filter(Boolean).join(" ").trim() || "N/A";
}

function buildScopedBranchIds(scope: ManageUserAccountsScope) {
  if (scope.roleName === "Admin") {
    return scope.selectedBranchId ? [scope.selectedBranchId] : [];
  }

  return scope.selectedBranchId ? [scope.selectedBranchId] : scope.allowedBranchIds;
}

function shouldShowAreaFilter(scope: Pick<ManageUserAccountsScope, "selectedBranchId" | "selectedRoleName">) {
  return Boolean(
    scope.selectedBranchId &&
      (scope.selectedRoleName === "Collector" || scope.selectedRoleName === "Borrower"),
  );
}

async function loadScopedUserIds(scope: ManageUserAccountsScope) {
  const scopedBranchIds = buildScopedBranchIds(scope);

  if (scope.roleName === "Admin" && scopedBranchIds.length === 0) {
    return null;
  }

  if (scopedBranchIds.length === 0) {
    return [];
  }

  const [borrowerRows, collectorRows, branchRows] = await Promise.all([
    db
      .select({ userId: borrower_info.user_id })
      .from(borrower_info)
      .innerJoin(areas, eq(areas.area_id, borrower_info.area_id))
      .where(
        and(
          inArray(areas.branch_id, scopedBranchIds),
          scope.selectedRoleName === "Borrower" && scope.selectedAreaId
            ? eq(borrower_info.area_id, scope.selectedAreaId)
            : undefined,
        ),
      )
      .catch(() => []),
    db
      .select({ userId: employee_area_assignment.employee_user_id })
      .from(employee_area_assignment)
      .innerJoin(areas, eq(areas.area_id, employee_area_assignment.area_id))
      .where(
        and(
          isNull(employee_area_assignment.end_date),
          inArray(areas.branch_id, scopedBranchIds),
          scope.selectedRoleName === "Collector" && scope.selectedAreaId
            ? eq(employee_area_assignment.area_id, scope.selectedAreaId)
            : undefined,
        ),
      )
      .catch(() => []),
    db
      .select({ userId: employee_branch_assignment.employee_user_id })
      .from(employee_branch_assignment)
      .where(
        and(
          isNull(employee_branch_assignment.end_date),
          inArray(employee_branch_assignment.branch_id, scopedBranchIds),
        ),
      )
      .catch(() => []),
  ]);

  return Array.from(
    new Set([
      ...borrowerRows.map((row) => row.userId),
      ...collectorRows.map((row) => row.userId),
      ...branchRows.map((row) => row.userId),
    ]),
  );
}

function buildManageUsersFilters(scope: ManageUserAccountsScope, scopedUserIds: string[] | null): SQL[] {
  const filters: SQL[] = [];

  filters.push(ne(users.user_id, scope.viewerUserId));

  if (scopedUserIds !== null) {
    if (scopedUserIds.length === 0) {
      filters.push(eq(users.user_id, "00000000-0000-0000-0000-000000000000"));
      return filters;
    }

    filters.push(inArray(users.user_id, scopedUserIds));
  }

  if (scope.selectedRoleName) {
    filters.push(eq(roles.role_name, scope.selectedRoleName));
  }

  filters.push(eq(users.status, scope.selectedStatus));

  if (scope.searchQuery) {
    const pattern = `%${scope.searchQuery}%`;
    filters.push(
      or(
        ilike(users.company_id, pattern),
        ilike(users.username, pattern),
        ilike(employee_info.first_name, pattern),
        ilike(employee_info.middle_name, pattern),
        ilike(employee_info.last_name, pattern),
        ilike(borrower_info.first_name, pattern),
        ilike(borrower_info.middle_name, pattern),
        ilike(borrower_info.last_name, pattern),
        ilike(
          sql<string>`concat_ws(' ', ${employee_info.first_name}, ${employee_info.middle_name}, ${employee_info.last_name})`,
          pattern,
        ),
        ilike(
          sql<string>`concat_ws(' ', ${borrower_info.first_name}, ${borrower_info.middle_name}, ${borrower_info.last_name})`,
          pattern,
        ),
      )!,
    );
  }

  return filters;
}

function buildManageUsersStatusCountsFilters(
  scope: ManageUserAccountsScope,
  scopedUserIds: string[] | null,
): SQL[] {
  const filters: SQL[] = [];

  filters.push(ne(users.user_id, scope.viewerUserId));

  if (scopedUserIds !== null) {
    if (scopedUserIds.length === 0) {
      filters.push(eq(users.user_id, "00000000-0000-0000-0000-000000000000"));
      return filters;
    }

    filters.push(inArray(users.user_id, scopedUserIds));
  }

  if (scope.selectedRoleName) {
    filters.push(eq(roles.role_name, scope.selectedRoleName));
  }

  if (scope.searchQuery) {
    const pattern = `%${scope.searchQuery}%`;
    filters.push(
      or(
        ilike(users.company_id, pattern),
        ilike(users.username, pattern),
        ilike(employee_info.first_name, pattern),
        ilike(employee_info.middle_name, pattern),
        ilike(employee_info.last_name, pattern),
        ilike(borrower_info.first_name, pattern),
        ilike(borrower_info.middle_name, pattern),
        ilike(borrower_info.last_name, pattern),
        ilike(
          sql<string>`concat_ws(' ', ${employee_info.first_name}, ${employee_info.middle_name}, ${employee_info.last_name})`,
          pattern,
        ),
        ilike(
          sql<string>`concat_ws(' ', ${borrower_info.first_name}, ${borrower_info.middle_name}, ${borrower_info.last_name})`,
          pattern,
        ),
      )!,
    );
  }

  return filters;
}

async function loadScopeMaps(userIds: string[]) {
  if (userIds.length === 0) {
    return {
      borrowerMap: new Map<string, { scopeLabel: string; contactLabel: string; address: string | null }>(),
      collectorMap: new Map<string, { scopeLabel: string }>(),
      employeeBranchMap: new Map<string, { scopeLabel: string }>(),
    };
  }

  const [borrowerRows, collectorRows, employeeBranchRows] = await Promise.all([
    db
      .select({
        userId: borrower_info.user_id,
        areaCode: areas.area_code,
        branchName: branch.branch_name,
        branchCode: branch.branch_code,
        contactNumber: users.contact_no,
        address: borrower_info.address,
      })
      .from(borrower_info)
      .innerJoin(users, eq(users.user_id, borrower_info.user_id))
      .innerJoin(areas, eq(areas.area_id, borrower_info.area_id))
      .innerJoin(branch, eq(branch.branch_id, areas.branch_id))
      .where(inArray(borrower_info.user_id, userIds))
      .catch(() => []),
    db
      .select({
        userId: employee_area_assignment.employee_user_id,
        areaCode: areas.area_code,
        branchName: branch.branch_name,
        branchCode: branch.branch_code,
      })
      .from(employee_area_assignment)
      .innerJoin(areas, eq(areas.area_id, employee_area_assignment.area_id))
      .innerJoin(branch, eq(branch.branch_id, areas.branch_id))
      .where(
        and(
          isNull(employee_area_assignment.end_date),
          inArray(employee_area_assignment.employee_user_id, userIds),
        ),
      )
      .catch(() => []),
    db
      .select({
        userId: employee_branch_assignment.employee_user_id,
        branchName: branch.branch_name,
        branchCode: branch.branch_code,
      })
      .from(employee_branch_assignment)
      .innerJoin(branch, eq(branch.branch_id, employee_branch_assignment.branch_id))
      .where(
        and(
          isNull(employee_branch_assignment.end_date),
          inArray(employee_branch_assignment.employee_user_id, userIds),
        ),
      )
      .catch(() => []),
  ]);

  const borrowerMap = new Map<
    string,
    { scopeLabel: string; contactLabel: string; address: string | null }
  >();
  for (const row of borrowerRows) {
    borrowerMap.set(row.userId, {
      scopeLabel: row.areaCode,
      contactLabel: row.contactNumber || "N/A",
      address: row.address,
    });
  }

  const collectorMap = new Map<string, { scopeLabel: string }>();
  for (const row of collectorRows) {
    collectorMap.set(row.userId, {
      scopeLabel: row.areaCode,
    });
  }

  const employeeBranchMap = new Map<string, { scopeLabel: string }>();
  const groupedBranches = new Map<string, string[]>();
  for (const row of employeeBranchRows) {
    const current = groupedBranches.get(row.userId) ?? [];
    current.push(row.branchCode || row.branchName);
    groupedBranches.set(row.userId, current);
  }
  for (const [userId, labels] of groupedBranches.entries()) {
    employeeBranchMap.set(userId, {
      scopeLabel: labels.join(", "),
    });
  }

  return {
    borrowerMap,
    collectorMap,
    employeeBranchMap,
  };
}

function resolveScopeLabel(
  userId: string,
  roleName: string,
  scopeMaps: Awaited<ReturnType<typeof loadScopeMaps>>,
) {
  if (roleName === "Admin") {
    return "Global";
  }

  if (roleName === "Borrower") {
    return scopeMaps.borrowerMap.get(userId)?.scopeLabel ?? "Unassigned";
  }

  if (roleName === "Collector") {
    return scopeMaps.collectorMap.get(userId)?.scopeLabel ?? "Unassigned";
  }

  return scopeMaps.employeeBranchMap.get(userId)?.scopeLabel ?? "Unassigned";
}

function resolveContactLabel(
  userId: string,
  roleName: string,
  email: string | null,
  contactNo: string | null,
  username: string,
  scopeMaps: Awaited<ReturnType<typeof loadScopeMaps>>,
) {
  if (email) {
    return email;
  }

  if (contactNo) {
    return contactNo;
  }

  if (roleName === "Borrower") {
    return scopeMaps.borrowerMap.get(userId)?.contactLabel ?? "N/A";
  }

  return username || "N/A";
}

function resolveEditableRoleNames(scope: ManageUserAccountsScope, row: { roleName: string }) {
  if (!canEditManagedUser(scope, row)) {
    return [];
  }

  if (row.roleName === "Borrower") {
    return [];
  }

  if (scope.roleName === "Admin") {
    if (row.roleName === "Secretary" || row.roleName === "Branch Manager") {
      return ["Branch Manager", "Secretary"];
    }

    return [row.roleName];
  }

  return [row.roleName];
}

async function loadBaseManageUsersRows(scope: ManageUserAccountsScope) {
  const scopedUserIds = await loadScopedUserIds(scope);
  const filters = buildManageUsersFilters(scope, scopedUserIds);
  const statusCountFilters = buildManageUsersStatusCountsFilters(scope, scopedUserIds);
  const requestedPage = Math.max(scope.page, 1);

  const [totalCount, statusCountsRows] = await Promise.all([
    db
      .select({ value: sql<number>`count(*)` })
      .from(users)
      .innerJoin(roles, eq(roles.role_id, users.role_id))
      .leftJoin(employee_info, eq(employee_info.user_id, users.user_id))
      .leftJoin(borrower_info, eq(borrower_info.user_id, users.user_id))
      .where(filters.length > 0 ? and(...filters) : undefined)
      .then((rows) => Number(rows[0]?.value) || 0)
      .catch(() => 0),
    db
      .select({
        status: users.status,
        value: sql<number>`count(*)`,
      })
      .from(users)
      .innerJoin(roles, eq(roles.role_id, users.role_id))
      .leftJoin(employee_info, eq(employee_info.user_id, users.user_id))
      .leftJoin(borrower_info, eq(borrower_info.user_id, users.user_id))
      .where(statusCountFilters.length > 0 ? and(...statusCountFilters) : undefined)
      .groupBy(users.status)
      .catch(() => []),
  ]);

  const activeCount = statusCountsRows.find((row) => row.status === "active")?.value ?? 0;
  const inactiveCount = statusCountsRows.find((row) => row.status === "inactive")?.value ?? 0;

  const totalPages = Math.max(Math.ceil(totalCount / MANAGE_USERS_PAGE_SIZE), 1);
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * MANAGE_USERS_PAGE_SIZE;

  const rows = await db
    .select({
      userId: users.user_id,
      companyId: users.company_id,
      username: users.username,
      email: users.email,
      contactNo: users.contact_no,
      dateCreated: users.date_created,
      status: users.status,
      roleName: roles.role_name,
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
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(asc(roles.role_name), asc(users.company_id))
    .limit(MANAGE_USERS_PAGE_SIZE)
    .offset(offset)
    .catch(() => []);

  return {
    totalCount,
    page,
    rows,
    activeCount: Number(activeCount) || 0,
    inactiveCount: Number(inactiveCount) || 0,
  };
}

export async function loadManageUserAccountsPageData(
  scope: ManageUserAccountsScope,
): Promise<ManageUserAccountsPageData> {
  const [branches, roleRows, areaRows] = await Promise.all([
    scope.canChooseBranch
      ? db
          .select({
            branchId: branch.branch_id,
            branchName: branch.branch_name,
          })
          .from(branch)
          .where(scope.roleName === "Admin" ? undefined : inArray(branch.branch_id, scope.allowedBranchIds))
          .orderBy(asc(branch.branch_name))
          .catch(() => [])
      : Promise.resolve([]),
    db
      .select({ roleName: roles.role_name })
      .from(roles)
      .orderBy(asc(roles.role_name))
      .catch(() => []),
    shouldShowAreaFilter(scope)
      ? db
          .select({
            areaId: areas.area_id,
            areaCode: areas.area_code,
          })
          .from(areas)
          .where(eq(areas.branch_id, scope.selectedBranchId!))
          .orderBy(asc(areas.area_code))
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  const selectedAreaId =
    shouldShowAreaFilter(scope) && scope.selectedAreaId && areaRows.some((row) => row.areaId === scope.selectedAreaId)
      ? scope.selectedAreaId
      : null;

  const resolvedScope: ManageUserAccountsScope = {
    ...scope,
    selectedAreaId,
  };

  const baseRows = await loadBaseManageUsersRows(resolvedScope);

  const scopeMaps = await loadScopeMaps(baseRows.rows.map((row) => row.userId));

  const usersRows: ManagedUserListRow[] = baseRows.rows.map((row) => {
    const isBorrower = row.roleName === "Borrower";
    const firstName = isBorrower ? row.borrowerFirstName : row.employeeFirstName;
    const middleName = isBorrower ? row.borrowerMiddleName : row.employeeMiddleName;
    const lastName = isBorrower ? row.borrowerLastName : row.employeeLastName;
    const fullName = formatFullName(firstName, middleName, lastName);
    const scopeLabel = resolveScopeLabel(row.userId, row.roleName, scopeMaps);

    return {
      userId: row.userId,
      fullName,
      companyId: row.companyId,
      username: row.username,
      roleName: row.roleName,
      scopeLabel,
      contactNo: row.contactNo,
      email: row.email,
      status: row.status,
      canView: true,
      canEdit: canEditManagedUser(scope, row),
      canManageStatus: canManageManagedUserStatus(scope, row),
      canDelete: canDeleteManagedUser(scope, row),
    };
  });

  return {
    branches: branches.map((row): ManagedUserBranchOption => ({
      branchId: row.branchId,
      branchName: row.branchName,
    })),
    roles: roleRows.map((row): ManagedUserRoleOption => ({
      roleName: row.roleName,
    })),
    areas: areaRows.map((row): ManagedUserAreaOption => ({
      areaId: row.areaId,
      areaCode: row.areaCode,
    })),
    users: usersRows,
    selectedAreaId,
    selectedStatus: resolvedScope.selectedStatus,
    activeCount: baseRows.activeCount,
    inactiveCount: baseRows.inactiveCount,
    page: baseRows.page,
    pageSize: MANAGE_USERS_PAGE_SIZE,
    totalCount: baseRows.totalCount,
  };
}

export async function loadManagedUserDetail(
  scope: ManageUserAccountsScope,
  userId: string,
): Promise<ManagedUserDetail | null> {
  const scopedUserIds = await loadScopedUserIds(scope);
  if (scopedUserIds !== null && !scopedUserIds.includes(userId)) {
    return null;
  }

  const row = await db
    .select({
      userId: users.user_id,
      roleId: roles.role_id,
      companyId: users.company_id,
      username: users.username,
      email: users.email,
      contactNo: users.contact_no,
      dateCreated: users.date_created,
      status: users.status,
      roleName: roles.role_name,
      employeeFirstName: employee_info.first_name,
      employeeMiddleName: employee_info.middle_name,
      employeeLastName: employee_info.last_name,
      borrowerFirstName: borrower_info.first_name,
      borrowerMiddleName: borrower_info.middle_name,
      borrowerLastName: borrower_info.last_name,
      address: borrower_info.address,
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

  const scopeMaps = await loadScopeMaps([userId]);
  const isBorrower = row.roleName === "Borrower";
  const firstName = isBorrower ? row.borrowerFirstName : row.employeeFirstName;
  const middleName = isBorrower ? row.borrowerMiddleName : row.employeeMiddleName;
  const lastName = isBorrower ? row.borrowerLastName : row.employeeLastName;
  const editableRoleNames = resolveEditableRoleNames(scope, row);
  const editableRoleRows = editableRoleNames.length
    ? await db
        .select({
          roleId: roles.role_id,
          roleName: roles.role_name,
        })
        .from(roles)
        .where(inArray(roles.role_name, editableRoleNames))
        .orderBy(asc(roles.role_name))
        .catch(() => [])
    : [];

  return {
    userId: row.userId,
    fullName: formatFullName(firstName, middleName, lastName),
    firstName: firstName ?? "",
    middleName: middleName ?? "",
    lastName: lastName ?? "",
    roleId: row.roleId,
    companyId: row.companyId,
    username: row.username,
    email: row.email,
    roleName: row.roleName,
    status: row.status,
    accountCategory: isBorrower ? "Borrower" : "Employee",
    scopeLabel: resolveScopeLabel(row.userId, row.roleName, scopeMaps),
    contactLabel: resolveContactLabel(
      row.userId,
      row.roleName,
      row.email,
      row.contactNo,
      row.username,
      scopeMaps,
    ),
    contactNo: row.contactNo,
    dateCreated: row.dateCreated,
    address: row.address,
    canEdit: canEditManagedUser(scope, row),
    canManageStatus: canManageManagedUserStatus(scope, row),
    canDelete: canDeleteManagedUser(scope, row),
    editableRoleOptions: editableRoleRows.map((item) => ({
      roleId: item.roleId,
      roleName: item.roleName,
    })),
  };
}

export async function loadManagedUserDetailByCompanyId(
  scope: ManageUserAccountsScope,
  companyId: string,
  expectedRoleName: string,
) {
  const row = await db
    .select({
      userId: users.user_id,
    })
    .from(users)
    .innerJoin(roles, eq(roles.role_id, users.role_id))
    .where(and(eq(users.company_id, companyId), eq(roles.role_name, expectedRoleName)))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!row) {
    return null;
  }

  return loadManagedUserDetail(scope, row.userId);
}

export async function updateManagedUserAccount(params: {
  scope: ManageUserAccountsScope;
  userId: string;
  roleId: number | null;
  email: string;
  firstName: string;
  middleName: string;
  lastName: string;
  contactNo: string;
}) {
  const detail = await loadManagedUserDetail(params.scope, params.userId);

  if (!detail) {
    return { ok: false as const, message: "User account not found in your scope." };
  }

  if (!detail.canEdit) {
    return { ok: false as const, message: "You are not allowed to edit this user account." };
  }

  if (!params.firstName) {
    return { ok: false as const, message: "First name is required." };
  }

  if (!params.lastName) {
    return { ok: false as const, message: "Last name is required." };
  }

  const editableRoleIds = new Set(detail.editableRoleOptions.map((item) => item.roleId ?? -1));
  const nextRoleId = params.roleId ?? detail.roleId;
  const canChangeRole = editableRoleIds.size > 1;

  if (detail.roleName === "Borrower" && nextRoleId !== detail.roleId) {
    return { ok: false as const, message: "Borrower accounts cannot be changed to another role." };
  }

  if (!canChangeRole && nextRoleId !== detail.roleId) {
    return { ok: false as const, message: "This role change is not allowed in this edit flow." };
  }

  if (canChangeRole && !editableRoleIds.has(nextRoleId)) {
    return { ok: false as const, message: "This role change is not allowed in this edit flow." };
  }

  const nextRole = detail.editableRoleOptions.find((item) => item.roleId === nextRoleId);
  const requiresContactNo = detail.roleName === "Borrower" || nextRole?.roleName === "Collector";

  if (requiresContactNo && !params.contactNo) {
    return { ok: false as const, message: "Contact number is required for this account." };
  }

  if (params.contactNo && !/^09\d{9}$/.test(params.contactNo)) {
    return { ok: false as const, message: "Enter a valid PH mobile number starting with 09." };
  }

  if (params.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(params.email)) {
    return { ok: false as const, message: "Enter a valid email address." };
  }

  try {
    await db
      .update(users)
      .set({
        role_id: nextRoleId,
        contact_no: params.contactNo || null,
        email: params.email || null,
        updated_at: new Date().toISOString(),
      })
      .where(eq(users.user_id, params.userId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    if (message.toLowerCase().includes("users_username_key")) {
      return { ok: false as const, message: "Username is already in use." };
    }
    return { ok: false as const, message: `Unable to update account details: ${message}` };
  }

  if (detail.accountCategory === "Borrower") {
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
}

export async function updateManagedUserStatus(params: {
  scope: ManageUserAccountsScope;
  userId: string;
  nextStatus: "active" | "inactive";
}) {
  const detail = await loadManagedUserDetail(params.scope, params.userId);

  if (!detail) {
    return { ok: false as const, message: "User account not found in your scope." };
  }

  if (!detail.canManageStatus) {
    return { ok: false as const, message: "You are not allowed to update this account status." };
  }

  if (detail.status === params.nextStatus) {
    return { ok: true as const };
  }

  await db
    .update(users)
    .set({
      status: params.nextStatus,
      updated_at: new Date().toISOString(),
    })
    .where(eq(users.user_id, params.userId));

  return { ok: true as const };
}

export async function deleteManagedUserAccount(scope: ManageUserAccountsScope, userId: string) {
  const detail = await loadManagedUserDetail(scope, userId);

  if (!detail) {
    return { ok: false as const, message: "User account not found in your scope." };
  }

  if (!detail.canDelete) {
    return { ok: false as const, message: "You are not allowed to delete this user account." };
  }

  const dependencyChecks = await Promise.all([
    db.select({ value: sql<number>`count(*)` }).from(loan_records).where(eq(loan_records.borrower_id, userId)).then((rows) => Number(rows[0]?.value) || 0).catch(() => 0),
    db.select({ value: sql<number>`count(*)` }).from(loan_records).where(eq(loan_records.collector_id, userId)).then((rows) => Number(rows[0]?.value) || 0).catch(() => 0),
    db.select({ value: sql<number>`count(*)` }).from(collections).where(eq(collections.encoded_by, userId)).then((rows) => Number(rows[0]?.value) || 0).catch(() => 0),
    db.select({ value: sql<number>`count(*)` }).from(expenses).where(eq(expenses.recorded_by, userId)).then((rows) => Number(rows[0]?.value) || 0).catch(() => 0),
    db.select({ value: sql<number>`count(*)` }).from(incentive_rules).where(eq(incentive_rules.created_by, userId)).then((rows) => Number(rows[0]?.value) || 0).catch(() => 0),
    db.select({ value: sql<number>`count(*)` }).from(incentive_payout_batches).where(eq(incentive_payout_batches.finalized_by, userId)).then((rows) => Number(rows[0]?.value) || 0).catch(() => 0),
    db.select({ value: sql<number>`count(*)` }).from(incentive_payout_history).where(eq(incentive_payout_history.employee_user_id, userId)).then((rows) => Number(rows[0]?.value) || 0).catch(() => 0),
    db.select({ value: sql<number>`count(*)` }).from(loan_docs).where(eq(loan_docs.uploaded_by, userId)).then((rows) => Number(rows[0]?.value) || 0).catch(() => 0),
    db.select({ value: sql<number>`count(*)` }).from(borrower_docs).where(eq(borrower_docs.uploaded_by, userId)).then((rows) => Number(rows[0]?.value) || 0).catch(() => 0),
    db.select({ value: sql<number>`count(*)` }).from(borrower_docs).where(eq(borrower_docs.borrower_id, userId)).then((rows) => Number(rows[0]?.value) || 0).catch(() => 0),
  ]);

  if (dependencyChecks.some((value) => value > 0)) {
    return {
      ok: false as const,
      message: "This account has linked operational records and cannot be deleted in this flow.",
    };
  }

  await db.delete(employee_branch_assignment).where(eq(employee_branch_assignment.employee_user_id, userId));
  await db.delete(employee_area_assignment).where(eq(employee_area_assignment.employee_user_id, userId));
  await db.delete(borrower_info).where(eq(borrower_info.user_id, userId));
  await db.delete(employee_info).where(eq(employee_info.user_id, userId));
  await db.delete(users).where(eq(users.user_id, userId));
  await deleteAuthUserSafely(userId);

  return { ok: true as const };
}
