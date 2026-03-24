import "server-only";

import { and, asc, desc, eq, ilike, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
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
  type ManagedCollectorBlockedActionType,
  type ManagedCollectorReassignmentCandidate,
  type ManagedCollectorReassignmentPreview,
  type ManagedCollectorReassignmentRequiredPayload,
  type ManagedCollectorReassignmentResult,
  type ManageUserAccountsPageData,
  type ManageUserAccountsScope,
  type ManageUserAccountsSort,
  type ManagedUserAreaOption,
  type ManagedUserBranchOption,
  type ManagedUserDetail,
  type ManagedUserListRow,
  type ManagedUserRoleOption,
} from "@/app/dashboard/manage-user-accounts/types";
import { deleteAuthUserSafely } from "@/app/dashboard/create-account/action-identifiers";
import { LIVE_STORED_LOAN_STATUSES } from "@/app/dashboard/loans/loan-state";
import { resolveReportsSystemUser } from "@/app/dashboard/reports/queries";

const MANAGE_USERS_PAGE_SIZE = 20;
const EDITABLE_EMPLOYEE_ROLE_NAMES = [
  "Admin",
  "Auditor",
  "Branch Manager",
  "Secretary",
  "Collector",
] as const;
const BRANCH_ASSIGNED_ROLE_NAMES = new Set(["Branch Manager", "Secretary", "Auditor"]);
const ROLE_SORT_ORDER_SQL = sql<number>`
  case
    when ${roles.role_name} = 'Admin' then 1
    when ${roles.role_name} = 'Auditor' then 2
    when ${roles.role_name} = 'Branch Manager' then 3
    when ${roles.role_name} = 'Secretary' then 4
    when ${roles.role_name} = 'Collector' then 5
    when ${roles.role_name} = 'Borrower' then 6
    else 999
  end
`;

type ActiveAssignmentState = {
  currentBranchId: number | null;
  currentBranchName: string | null;
  currentAreaId: number | null;
  currentAreaCode: string | null;
  currentAreaBranchId: number | null;
  currentBranchCode: string | null;
  activeBranchAssignments: { branchId: number; branchName: string; branchCode: string }[];
};

type ManagedUserMutationResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
      errorType?: "reassignment_required";
      reassignmentRequired?: true;
      actionType?: ManagedCollectorBlockedActionType;
      collectorId?: string;
      currentRole?: string;
      nextRole?: string | null;
      nextBranchId?: number | null;
      nextAreaId?: number | null;
      activeLoanCount?: number;
      overdueLoanCount?: number;
      totalLiveLoanCount?: number;
    };

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

async function loadHiddenManagedUserIds() {
  const systemUserResult = await resolveReportsSystemUser();

  return systemUserResult.ok ? [systemUserResult.user.userId] : [];
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
    return [...EDITABLE_EMPLOYEE_ROLE_NAMES];
  }

  if (scope.roleName === "Branch Manager" && row.roleName === "Collector") {
    return ["Collector", "Secretary"];
  }

  return [];
}

function buildManageUserSortOrder(sort: ManageUserAccountsSort) {
  if (sort === "date_created_asc") {
    return [asc(users.date_created), asc(users.company_id)] as const;
  }

  if (sort === "date_created_desc") {
    return [desc(users.date_created), asc(users.company_id)] as const;
  }

  if (sort === "role_desc") {
    return [desc(ROLE_SORT_ORDER_SQL), asc(users.company_id)] as const;
  }

  return [asc(ROLE_SORT_ORDER_SQL), asc(users.company_id)] as const;
}

async function loadActiveAssignmentState(userId: string): Promise<ActiveAssignmentState> {
  const [activeBranchAssignments, activeAreaAssignment] = await Promise.all([
    db
      .select({
        branchId: employee_branch_assignment.branch_id,
        branchName: branch.branch_name,
        branchCode: branch.branch_code,
      })
      .from(employee_branch_assignment)
      .innerJoin(branch, eq(branch.branch_id, employee_branch_assignment.branch_id))
      .where(
        and(
          eq(employee_branch_assignment.employee_user_id, userId),
          isNull(employee_branch_assignment.end_date),
        ),
      )
      .orderBy(asc(branch.branch_name))
      .catch(() => []),
    db
      .select({
        areaId: employee_area_assignment.area_id,
        areaCode: areas.area_code,
        branchId: areas.branch_id,
        branchName: branch.branch_name,
        branchCode: branch.branch_code,
      })
      .from(employee_area_assignment)
      .innerJoin(areas, eq(areas.area_id, employee_area_assignment.area_id))
      .innerJoin(branch, eq(branch.branch_id, areas.branch_id))
      .where(
        and(
          eq(employee_area_assignment.employee_user_id, userId),
          isNull(employee_area_assignment.end_date),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null),
  ]);

  return {
    currentBranchId: activeBranchAssignments[0]?.branchId ?? activeAreaAssignment?.branchId ?? null,
    currentBranchName: activeBranchAssignments[0]?.branchName ?? activeAreaAssignment?.branchName ?? null,
    currentBranchCode: activeBranchAssignments[0]?.branchCode ?? activeAreaAssignment?.branchCode ?? null,
    currentAreaId: activeAreaAssignment?.areaId ?? null,
    currentAreaCode: activeAreaAssignment?.areaCode ?? null,
    currentAreaBranchId: activeAreaAssignment?.branchId ?? null,
    activeBranchAssignments,
  };
}

async function countLiveCollectorLoans(userId: string) {
  return db
    .select({
      activeLoanCount: sql<number>`coalesce(sum(case when ${loan_records.status} = 'active' then 1 else 0 end), 0)`,
      overdueLoanCount: sql<number>`coalesce(sum(case when ${loan_records.status} = 'overdue' then 1 else 0 end), 0)`,
    })
    .from(loan_records)
    .where(eq(loan_records.collector_id, userId))
    .limit(1)
    .then((rows) => {
      const row = rows[0];
      const activeLoanCount = Number(row?.activeLoanCount) || 0;
      const overdueLoanCount = Number(row?.overdueLoanCount) || 0;
      return {
        activeLoanCount,
        overdueLoanCount,
        totalLiveLoanCount: activeLoanCount + overdueLoanCount,
      };
    })
    .catch(() => ({
      activeLoanCount: 0,
      overdueLoanCount: 0,
      totalLiveLoanCount: 0,
    }));
}

function buildCollectorReassignmentRequiredResult(params: {
  actionType: ManagedCollectorBlockedActionType;
  collectorId: string;
  currentRole: string;
  nextRole?: string | null;
  nextBranchId?: number | null;
  nextAreaId?: number | null;
  counts: { activeLoanCount: number; overdueLoanCount: number; totalLiveLoanCount: number };
}): ManagedUserMutationResult {
  const actionMessage =
    params.actionType === "role_change"
      ? "before changing this collector"
      : params.actionType === "branch_reassignment" || params.actionType === "area_reassignment"
        ? "before moving this collector"
        : params.actionType === "deactivate"
          ? "before deactivating this collector"
          : "before deleting this collector";

  return {
    ok: false,
    errorType: "reassignment_required",
    reassignmentRequired: true,
    actionType: params.actionType,
    collectorId: params.collectorId,
    currentRole: params.currentRole,
    nextRole: params.nextRole ?? null,
    nextBranchId: params.nextBranchId ?? null,
    nextAreaId: params.nextAreaId ?? null,
    activeLoanCount: params.counts.activeLoanCount,
    overdueLoanCount: params.counts.overdueLoanCount,
    totalLiveLoanCount: params.counts.totalLiveLoanCount,
    message: `This collector still has active or overdue loans assigned (${params.counts.activeLoanCount} active, ${params.counts.overdueLoanCount} overdue). Reassign the live loans first ${actionMessage}.`,
  };
}

async function maybeBuildCollectorStructuralBlock(params: {
  collectorId: string;
  currentRole: string;
  nextRole: string;
  currentBranchId: number | null;
  currentAreaId: number | null;
  requestedBranchId: number | null;
  requestedAreaId: number | null;
}): Promise<ManagedUserMutationResult | null> {
  let actionType: ManagedCollectorBlockedActionType | null = null;

  if (params.nextRole !== "Collector") {
    actionType = "role_change";
  } else if (params.requestedBranchId !== null && params.requestedBranchId !== params.currentBranchId) {
    actionType = "branch_reassignment";
  } else if (params.requestedAreaId !== null && params.requestedAreaId !== params.currentAreaId) {
    actionType = "area_reassignment";
  }

  if (!actionType) {
    return null;
  }

  const counts = await countLiveCollectorLoans(params.collectorId);
  if (counts.totalLiveLoanCount <= 0) {
    return null;
  }

  return buildCollectorReassignmentRequiredResult({
    actionType,
    collectorId: params.collectorId,
    currentRole: params.currentRole,
    nextRole: params.nextRole,
    nextBranchId: params.requestedBranchId,
    nextAreaId: params.requestedAreaId,
    counts,
  });
}

async function maybeBuildCollectorLifecycleBlock(params: {
  actionType: "deactivate" | "delete";
  collectorId: string;
  currentRole: string;
}): Promise<ManagedUserMutationResult | null> {
  const counts = await countLiveCollectorLoans(params.collectorId);
  if (counts.totalLiveLoanCount <= 0) {
    return null;
  }

  return buildCollectorReassignmentRequiredResult({
    actionType: params.actionType,
    collectorId: params.collectorId,
    currentRole: params.currentRole,
    counts,
  });
}

type CollectorReassignmentContext =
  ManagedCollectorReassignmentRequiredPayload & {
    collectorName: string;
    collectorCompanyId: string;
    currentAreaId: number | null;
    currentAreaCode: string | null;
    currentBranchId: number | null;
    currentBranchCode: string | null;
  };

async function loadCollectorReassignmentContext(params: {
  scope: ManageUserAccountsScope;
  collectorId: string;
  actionType: ManagedCollectorBlockedActionType;
  nextRole?: string | null;
  nextBranchId?: number | null;
  nextAreaId?: number | null;
}): Promise<CollectorReassignmentContext | ManagedUserMutationResult> {
  const detail = await loadManagedUserDetail(params.scope, params.collectorId);

  if (!detail) {
    return { ok: false as const, message: "Collector account not found in your scope." };
  }

  if (detail.roleName !== "Collector") {
    return { ok: false as const, message: "Loan reassignment is only available for collector accounts." };
  }

  if (params.scope.roleName === "Auditor") {
    return { ok: false as const, message: "Auditor accounts are read-only in this flow." };
  }

  if (params.actionType === "deactivate") {
    if (!detail.canManageStatus) {
      return { ok: false as const, message: "You are not allowed to update this account status." };
    }
  } else if (params.actionType === "delete") {
    if (!detail.canDelete) {
      return { ok: false as const, message: "You are not allowed to delete this user account." };
    }
  } else if (!detail.canEdit) {
    return { ok: false as const, message: "You are not allowed to edit this user account." };
  }

  const assignmentState = await loadActiveAssignmentState(params.collectorId);
  const counts = await countLiveCollectorLoans(params.collectorId);
  const blockerResult = buildCollectorReassignmentRequiredResult({
    actionType: params.actionType,
    collectorId: params.collectorId,
    currentRole: detail.roleName,
    nextRole: params.nextRole ?? null,
    nextBranchId: params.nextBranchId ?? null,
    nextAreaId: params.nextAreaId ?? null,
    counts,
  });

  return {
    errorType: "reassignment_required",
    reassignmentRequired: true,
    actionType: params.actionType,
    collectorId: params.collectorId,
    collectorName: detail.fullName,
    collectorCompanyId: detail.companyId,
    currentRole: detail.roleName,
    nextRole: params.nextRole ?? null,
    nextBranchId: params.nextBranchId ?? null,
    nextAreaId: params.nextAreaId ?? null,
    activeLoanCount: counts.activeLoanCount,
    overdueLoanCount: counts.overdueLoanCount,
    totalLiveLoanCount: counts.totalLiveLoanCount,
    message: blockerResult.ok ? "Reassignment is required first." : blockerResult.message,
    currentAreaId: assignmentState.currentAreaId,
    currentAreaCode: assignmentState.currentAreaCode,
    currentBranchId: assignmentState.currentBranchId,
    currentBranchCode: assignmentState.currentBranchCode,
  };
}

function resolveCollectorCandidateScopeLabel(context: CollectorReassignmentContext) {
  if (context.actionType === "branch_reassignment") {
    return context.currentBranchCode
      ? `Choose an active collector in branch ${context.currentBranchCode}.`
      : "Choose an active collector in the same branch.";
  }

  return context.currentAreaCode
    ? `Choose an active collector in area ${context.currentAreaCode}.`
    : "Choose an active collector in the same area.";
}

async function loadCollectorReplacementCandidates(
  scope: ManageUserAccountsScope,
  context: CollectorReassignmentContext,
): Promise<ManagedCollectorReassignmentCandidate[]> {
  if (context.actionType === "branch_reassignment") {
    if (context.currentBranchId === null) {
      return [];
    }
  } else if (context.currentAreaId === null) {
    return [];
  }

  const managerBranchId = scope.allowedBranchIds[0] ?? null;

  return db
    .select({
      userId: users.user_id,
      companyId: users.company_id,
      firstName: employee_info.first_name,
      middleName: employee_info.middle_name,
      lastName: employee_info.last_name,
      areaId: areas.area_id,
      areaCode: areas.area_code,
      branchId: branch.branch_id,
      branchCode: branch.branch_code,
      branchName: branch.branch_name,
    })
    .from(users)
    .innerJoin(roles, eq(roles.role_id, users.role_id))
    .innerJoin(employee_info, eq(employee_info.user_id, users.user_id))
    .innerJoin(
      employee_area_assignment,
      and(
        eq(employee_area_assignment.employee_user_id, users.user_id),
        isNull(employee_area_assignment.end_date),
      ),
    )
    .innerJoin(areas, eq(areas.area_id, employee_area_assignment.area_id))
    .innerJoin(branch, eq(branch.branch_id, areas.branch_id))
    .where(
      and(
        ne(users.user_id, context.collectorId),
        eq(users.status, "active"),
        eq(roles.role_name, "Collector"),
        context.actionType === "branch_reassignment"
          ? eq(areas.branch_id, context.currentBranchId!)
          : eq(areas.area_id, context.currentAreaId!),
        scope.roleName === "Branch Manager" && managerBranchId !== null
          ? eq(areas.branch_id, managerBranchId)
          : undefined,
      ),
    )
    .orderBy(asc(employee_info.first_name), asc(employee_info.last_name), asc(users.company_id))
    .then((rows) =>
      rows.map((row) => ({
        userId: row.userId,
        fullName: formatFullName(row.firstName, row.middleName, row.lastName),
        companyId: row.companyId,
        areaId: row.areaId,
        areaCode: row.areaCode,
        branchId: row.branchId,
        branchCode: row.branchCode,
        branchName: row.branchName,
      })),
    )
    .catch(() => []);
}

async function loadCollectorReplacementCandidateById(params: {
  scope: ManageUserAccountsScope;
  context: CollectorReassignmentContext;
  replacementCollectorId: string;
}): Promise<ManagedCollectorReassignmentCandidate | null> {
  const candidates = await loadCollectorReplacementCandidates(params.scope, params.context);
  return candidates.find((item) => item.userId === params.replacementCollectorId) ?? null;
}

export async function loadCollectorLoanReassignmentPreview(params: {
  scope: ManageUserAccountsScope;
  collectorId: string;
  actionType: ManagedCollectorBlockedActionType;
  nextRole?: string | null;
  nextBranchId?: number | null;
  nextAreaId?: number | null;
}): Promise<ManagedCollectorReassignmentPreview | ManagedUserMutationResult> {
  const context = await loadCollectorReassignmentContext(params);

  if ("ok" in context) {
    return context;
  }

  const candidates = await loadCollectorReplacementCandidates(params.scope, context);

  return {
    ...context,
    candidateScopeLabel: resolveCollectorCandidateScopeLabel(context),
    candidates,
  };
}

export async function reassignCollectorLiveLoans(params: {
  scope: ManageUserAccountsScope;
  collectorId: string;
  replacementCollectorId: string;
  actionType: ManagedCollectorBlockedActionType;
  nextRole?: string | null;
  nextBranchId?: number | null;
  nextAreaId?: number | null;
}): Promise<ManagedCollectorReassignmentResult | ManagedUserMutationResult> {
  const context = await loadCollectorReassignmentContext(params);

  if ("ok" in context) {
    return context;
  }

  const replacementCollector = await loadCollectorReplacementCandidateById({
    scope: params.scope,
    context,
    replacementCollectorId: params.replacementCollectorId,
  });

  if (!replacementCollector) {
    return {
      ok: false as const,
      message:
        context.actionType === "branch_reassignment"
          ? "Select an active collector in the same branch."
          : "Select an active collector in the same area.",
    };
  }

  const reassignedRows = await db
    .update(loan_records)
    .set({ collector_id: params.replacementCollectorId })
    .where(
      and(
        eq(loan_records.collector_id, params.collectorId),
        inArray(loan_records.status, [...LIVE_STORED_LOAN_STATUSES]),
      ),
    )
    .returning({ loanId: loan_records.loan_id });

  return {
    ok: true as const,
    reassignedLoanCount: reassignedRows.length,
    replacementCollectorId: replacementCollector.userId,
    replacementCollectorName: replacementCollector.fullName,
  };
}

async function countLiveBorrowerLoans(userId: string) {
  return db
    .select({ value: sql<number>`count(*)` })
    .from(loan_records)
    .where(
      and(
        eq(loan_records.borrower_id, userId),
        inArray(loan_records.status, [...LIVE_STORED_LOAN_STATUSES]),
      ),
    )
    .then((rows) => Number(rows[0]?.value) || 0)
    .catch(() => 0);
}

async function findConflictingSingleBranchRoleAssignee(params: {
  roleName: "Branch Manager";
  branchId: number;
  excludeUserId: string;
}) {
  return db
    .select({
      userId: users.user_id,
      firstName: employee_info.first_name,
      middleName: employee_info.middle_name,
      lastName: employee_info.last_name,
      companyId: users.company_id,
      branchName: branch.branch_name,
    })
    .from(employee_branch_assignment)
    .innerJoin(users, eq(users.user_id, employee_branch_assignment.employee_user_id))
    .innerJoin(roles, eq(roles.role_id, users.role_id))
    .innerJoin(employee_info, eq(employee_info.user_id, users.user_id))
    .innerJoin(branch, eq(branch.branch_id, employee_branch_assignment.branch_id))
    .where(
      and(
        eq(employee_branch_assignment.branch_id, params.branchId),
        isNull(employee_branch_assignment.end_date),
        eq(roles.role_name, params.roleName),
        ne(users.user_id, params.excludeUserId),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);
}

async function findConflictingAuditorAssignments(params: {
  branchIds: number[];
  excludeUserId: string;
}) {
  if (params.branchIds.length === 0) {
    return [];
  }

  return db
    .select({
      branchId: employee_branch_assignment.branch_id,
      branchName: branch.branch_name,
      branchCode: branch.branch_code,
    })
    .from(employee_branch_assignment)
    .innerJoin(users, eq(users.user_id, employee_branch_assignment.employee_user_id))
    .innerJoin(roles, eq(roles.role_id, users.role_id))
    .innerJoin(branch, eq(branch.branch_id, employee_branch_assignment.branch_id))
    .where(
      and(
        inArray(employee_branch_assignment.branch_id, params.branchIds),
        isNull(employee_branch_assignment.end_date),
        eq(roles.role_name, "Auditor"),
        ne(users.user_id, params.excludeUserId),
      ),
    )
    .catch(() => []);
}

async function loadBaseManageUsersRows(scope: ManageUserAccountsScope) {
  const [scopedUserIds, hiddenUserIds] = await Promise.all([
    loadScopedUserIds(scope),
    loadHiddenManagedUserIds(),
  ]);
  const filters = buildManageUsersFilters(scope, scopedUserIds);
  const statusCountFilters = buildManageUsersStatusCountsFilters(scope, scopedUserIds);
  const requestedPage = Math.max(scope.page, 1);
  const sortOrder = buildManageUserSortOrder(scope.selectedSort);

  if (hiddenUserIds.length > 0) {
    filters.push(ne(users.user_id, hiddenUserIds[0]!));
    statusCountFilters.push(ne(users.user_id, hiddenUserIds[0]!));
  }

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
    .orderBy(...sortOrder)
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
      branchId: scope.selectedBranchId ?? undefined,
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
  const hiddenUserIds = await loadHiddenManagedUserIds();
  if (hiddenUserIds.includes(userId)) {
    return null;
  }

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

  const assignmentState = await loadActiveAssignmentState(userId);

  const scopeMaps = await loadScopeMaps([userId]);
  const isBorrower = row.roleName === "Borrower";
  const firstName = isBorrower ? row.borrowerFirstName : row.employeeFirstName;
  const middleName = isBorrower ? row.borrowerMiddleName : row.employeeMiddleName;
  const lastName = isBorrower ? row.borrowerLastName : row.employeeLastName;
  const editableRoleNames = resolveEditableRoleNames(scope, row);
  const canEditRole =
    row.roleName !== "Borrower" &&
    ((scope.roleName === "Admin" && !isBorrower) ||
      (scope.roleName === "Branch Manager" && row.roleName === "Collector"));
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
  const currentBranchId = assignmentState.currentBranchId;
  const currentBranchName = assignmentState.currentBranchName;
  const currentAreaId = assignmentState.currentAreaId;
  const currentAreaCode = assignmentState.currentAreaCode;
  const currentBranchAssignments = assignmentState.activeBranchAssignments.map((item) => ({
    branchId: item.branchId,
    branchName: item.branchName,
    branchCode: item.branchCode,
  }));
  const canEditBranchAssignment = scope.roleName === "Admin" && !isBorrower;
  const canEditAuditorBranchAssignments = scope.roleName === "Admin" && !isBorrower;
  const branchManagerBranchId = scope.allowedBranchIds[0] ?? null;
  const canEditAreaAssignment =
    !isBorrower &&
    (scope.roleName === "Admin" ||
      (scope.roleName === "Branch Manager" &&
        row.roleName === "Collector" &&
        branchManagerBranchId !== null &&
        currentBranchId === branchManagerBranchId));
  const editableBranchOptions = canEditBranchAssignment
    ? await db
        .select({
          branchId: branch.branch_id,
          branchName: branch.branch_name,
          branchCode: branch.branch_code,
        })
        .from(branch)
        .where(eq(branch.status, "active"))
        .orderBy(asc(branch.branch_name))
        .catch(() => [])
    : [];
  const editableAreaOptions = canEditAreaAssignment
    ? await db
        .select({
          areaId: areas.area_id,
          areaCode: areas.area_code,
          branchId: areas.branch_id,
        })
        .from(areas)
        .innerJoin(branch, eq(branch.branch_id, areas.branch_id))
        .where(
          and(
            eq(branch.status, "active"),
            eq(areas.status, "active"),
            scope.roleName === "Branch Manager" && branchManagerBranchId !== null
              ? eq(areas.branch_id, branchManagerBranchId)
              : undefined,
          ),
        )
        .orderBy(asc(areas.area_code))
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
    canEditRole,
    editableRoleOptions: editableRoleRows.map((item) => ({
      roleId: item.roleId,
      roleName: item.roleName,
    })),
    canEditBranchAssignment,
    canEditAuditorBranchAssignments,
    canEditAreaAssignment,
    currentBranchId,
    currentBranchName,
    currentAreaId,
    currentAreaCode,
    currentBranchAssignments,
    editableBranchOptions,
    editableAreaOptions,
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
  branchId: number | null;
  branchIds: number[];
  areaId: number | null;
}): Promise<ManagedUserMutationResult> {
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
  const canChangeRole = detail.canEditRole;

  const nextRoleOption =
    detail.editableRoleOptions.find((item) => item.roleId === nextRoleId) ??
    (nextRoleId === detail.roleId ? { roleId: detail.roleId, roleName: detail.roleName } : null);
  const nextRoleName = nextRoleOption?.roleName ?? detail.roleName;
  const roleChanged = nextRoleName !== detail.roleName;

  if (detail.roleName === "Borrower" || nextRoleName === "Borrower") {
    if (nextRoleId !== detail.roleId) {
      return { ok: false as const, message: "Borrower accounts cannot be changed to another role." };
    }
  }

  if (!canChangeRole && nextRoleId !== detail.roleId) {
    return { ok: false as const, message: "This role change is not allowed in this edit flow." };
  }

  if (canChangeRole && !editableRoleIds.has(nextRoleId)) {
    return { ok: false as const, message: "This role change is not allowed in this edit flow." };
  }

  if (params.scope.roleName === "Auditor") {
    return { ok: false as const, message: "Auditor accounts are read-only in this flow." };
  }

  const assignmentState = await loadActiveAssignmentState(params.userId);
  const currentBranchId = assignmentState.currentBranchId;
  const currentAreaId = assignmentState.currentAreaId;
  const requestedBranchId = params.branchId ?? currentBranchId;
  const requestedAreaId = params.areaId ?? currentAreaId;
  const requestedBranchIds = Array.from(
    new Set(params.branchIds.filter((value): value is number => Number.isFinite(value))),
  );
  const managerBranchId = params.scope.allowedBranchIds[0] ?? null;
  const requiresContactNo = detail.roleName === "Borrower" || nextRoleName === "Collector";

  if (requiresContactNo && !params.contactNo) {
    return { ok: false as const, message: "Contact number is required for this account." };
  }

  if (params.contactNo && !/^09\d{9}$/.test(params.contactNo)) {
    return { ok: false as const, message: "Enter a valid PH mobile number starting with 09." };
  }

  if (params.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(params.email)) {
    return { ok: false as const, message: "Enter a valid email address." };
  }

  if (
    detail.accountCategory === "Borrower" &&
    (params.branchId !== null || params.areaId !== null || requestedBranchIds.length > 0)
  ) {
    return { ok: false as const, message: "Borrowers cannot be reassigned." };
  }

  if (detail.roleName === "Collector") {
    const structuralBlock = await maybeBuildCollectorStructuralBlock({
      collectorId: params.userId,
      currentRole: detail.roleName,
      nextRole: nextRoleName,
      currentBranchId,
      currentAreaId,
      requestedBranchId,
      requestedAreaId,
    });

    if (structuralBlock) {
      return structuralBlock;
    }
  }

  if (params.scope.roleName === "Branch Manager") {
    if (detail.roleName === "Collector") {
      if (currentBranchId === null || managerBranchId === null || currentBranchId !== managerBranchId) {
        return {
          ok: false as const,
          message: "You can only manage collectors assigned to your own branch.",
        };
      }
      if (!["Collector", "Secretary"].includes(nextRoleName)) {
        return {
          ok: false as const,
          message: "Branch Manager can only keep this account as Collector or promote it to Secretary.",
        };
      }
      if (requestedBranchId !== currentBranchId) {
        return {
          ok: false as const,
          message: "Branch reassignment is not allowed in this edit flow.",
        };
      }
    } else {
      if (params.branchId !== null && params.branchId !== currentBranchId) {
        return {
          ok: false as const,
          message: "Branch reassignment is not allowed in this edit flow.",
        };
      }
      if (params.areaId !== null && params.areaId !== currentAreaId) {
        return {
          ok: false as const,
          message: "Area reassignment is not allowed for this account in your edit flow.",
        };
      }
    }
  }

  const needsCollectorArea = nextRoleName === "Collector";
  const needsAuditorBranchAssignments = nextRoleName === "Auditor";
  const needsSingleBranchAssignment =
    BRANCH_ASSIGNED_ROLE_NAMES.has(nextRoleName) && nextRoleName !== "Auditor";

  let validatedBranchId: number | null = null;
  let validatedAreaId: number | null = null;
  let validatedBranchIds: number[] = [];

  if (needsCollectorArea) {
    if (!requestedAreaId) {
      return { ok: false as const, message: "Area assignment is required for collector accounts." };
    }

    const areaRow = await db
      .select({
        areaId: areas.area_id,
        areaCode: areas.area_code,
        branchId: areas.branch_id,
        areaStatus: areas.status,
        branchStatus: branch.status,
      })
      .from(areas)
      .innerJoin(branch, eq(branch.branch_id, areas.branch_id))
      .where(eq(areas.area_id, requestedAreaId))
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null);

    if (!areaRow) {
      return { ok: false as const, message: "Selected area was not found." };
    }

    if (params.scope.roleName === "Branch Manager" && managerBranchId !== areaRow.branchId) {
      return {
        ok: false as const,
        message: "You can only reassign collectors to areas within your own branch.",
      };
    }

    if (requestedBranchId && requestedBranchId !== areaRow.branchId) {
      return {
        ok: false as const,
        message: "Selected area does not belong to the selected branch.",
      };
    }

    if (areaRow.branchStatus !== "active" && (areaRow.areaId !== currentAreaId || roleChanged)) {
      return {
        ok: false as const,
        message: "Inactive branches cannot receive new area assignments in this flow.",
      };
    }

    if (areaRow.areaStatus !== "active" && (areaRow.areaId !== currentAreaId || roleChanged)) {
      return {
        ok: false as const,
        message: "Inactive areas cannot receive new assignments in this flow.",
      };
    }

    validatedAreaId = areaRow.areaId;
    validatedBranchId = areaRow.branchId;
  } else if (needsAuditorBranchAssignments) {
    if (params.scope.roleName !== "Admin") {
      return {
        ok: false as const,
        message: "Only Admin can assign auditor branch jurisdictions in this flow.",
      };
    }

    if (requestedBranchIds.length === 0) {
      return {
        ok: false as const,
        message: "Auditor accounts must have at least one branch assignment.",
      };
    }

    const branchRows = await db
      .select({
        branchId: branch.branch_id,
        branchName: branch.branch_name,
        branchCode: branch.branch_code,
        status: branch.status,
      })
      .from(branch)
      .where(inArray(branch.branch_id, requestedBranchIds))
      .catch(() => []);

    if (branchRows.length !== requestedBranchIds.length) {
      return {
        ok: false as const,
        message: "One or more selected branches were not found.",
      };
    }

    const currentAuditorBranchIds = assignmentState.activeBranchAssignments.map((item) => item.branchId).sort((a, b) => a - b);
    const nextAuditorBranchIds = [...requestedBranchIds].sort((a, b) => a - b);
    const auditorAssignmentsChanging =
      currentAuditorBranchIds.length !== nextAuditorBranchIds.length ||
      currentAuditorBranchIds.some((branchId, index) => branchId !== nextAuditorBranchIds[index]);

    if ((roleChanged || auditorAssignmentsChanging) && branchRows.some((item) => item.status !== "active")) {
      return {
        ok: false as const,
        message: "Inactive branches cannot receive new auditor jurisdiction assignments.",
      };
    }

    const conflictingAuditorAssignments = await findConflictingAuditorAssignments({
      branchIds: requestedBranchIds,
      excludeUserId: params.userId,
    });

    if (conflictingAuditorAssignments.length > 0) {
      const branchLabel = conflictingAuditorAssignments
        .map((item) => item.branchCode || item.branchName)
        .join(", ");

      return {
        ok: false as const,
        message: `Each branch can only have one Auditor. Resolve the existing Auditor assignment for ${branchLabel} first.`,
      };
    }

    validatedBranchIds = requestedBranchIds;
  } else if (needsSingleBranchAssignment) {
    const effectiveBranchId =
      params.scope.roleName === "Branch Manager" ? currentBranchId ?? managerBranchId : requestedBranchId;

    if (!effectiveBranchId) {
      return { ok: false as const, message: "Branch assignment is required for this role." };
    }

    const branchRow = await db
      .select({
        branchId: branch.branch_id,
        status: branch.status,
      })
      .from(branch)
      .where(eq(branch.branch_id, effectiveBranchId))
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null);

    if (!branchRow) {
      return { ok: false as const, message: "Selected branch was not found." };
    }

    if (params.scope.roleName === "Branch Manager" && managerBranchId !== effectiveBranchId) {
      return {
        ok: false as const,
        message: "You can only manage assignments within your own branch.",
      };
    }

    if (branchRow.status !== "active" && (branchRow.branchId !== currentBranchId || roleChanged)) {
      return {
        ok: false as const,
        message: "Inactive branches cannot receive new assignments in this flow.",
      };
    }

    if (nextRoleName === "Branch Manager") {
      const existingBranchManager = await findConflictingSingleBranchRoleAssignee({
        roleName: "Branch Manager",
        branchId: branchRow.branchId,
        excludeUserId: params.userId,
      });

      if (existingBranchManager) {
        return {
          ok: false as const,
          message: `Each branch can only have one Branch Manager. ${formatFullName(existingBranchManager.firstName, existingBranchManager.middleName, existingBranchManager.lastName)} (${existingBranchManager.companyId}) is already assigned to ${existingBranchManager.branchName}.`,
        };
      }
    }

    validatedBranchId = branchRow.branchId;
  } else {
    if (params.scope.roleName === "Branch Manager") {
      if (params.branchId !== null && params.branchId !== currentBranchId) {
        return {
          ok: false as const,
          message: "Branch reassignment is not allowed in this edit flow.",
        };
      }
      if (params.areaId !== null && params.areaId !== currentAreaId) {
        return {
          ok: false as const,
          message: "Area reassignment is not allowed in this edit flow.",
        };
      }
    }
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

  const today = new Date().toISOString().slice(0, 10);
  const shouldHaveAreaAssignment = nextRoleName === "Collector";
  if (shouldHaveAreaAssignment) {
    if (currentAreaId !== validatedAreaId) {
      await db
        .update(employee_area_assignment)
        .set({ end_date: today })
        .where(
          and(
            eq(employee_area_assignment.employee_user_id, params.userId),
            isNull(employee_area_assignment.end_date),
          ),
        );

      await db.insert(employee_area_assignment).values({
        employee_user_id: params.userId,
        area_id: validatedAreaId!,
        start_date: today,
        end_date: null,
      });
    }

    await db
      .update(employee_branch_assignment)
      .set({ end_date: today })
      .where(
        and(
          eq(employee_branch_assignment.employee_user_id, params.userId),
          isNull(employee_branch_assignment.end_date),
        ),
      );
  } else {
    await db
      .update(employee_area_assignment)
      .set({ end_date: today })
      .where(
        and(
          eq(employee_area_assignment.employee_user_id, params.userId),
          isNull(employee_area_assignment.end_date),
        ),
      );
  }

  if (nextRoleName === "Auditor") {
    const activeBranchIds = assignmentState.activeBranchAssignments.map((item) => item.branchId).sort((a, b) => a - b);
    const nextAuditorBranchIds = [...validatedBranchIds].sort((a, b) => a - b);
    const branchesChanged =
      activeBranchIds.length !== nextAuditorBranchIds.length ||
      activeBranchIds.some((branchId, index) => branchId !== nextAuditorBranchIds[index]);

    if (branchesChanged) {
      await db
        .update(employee_branch_assignment)
        .set({ end_date: today })
        .where(
          and(
            eq(employee_branch_assignment.employee_user_id, params.userId),
            isNull(employee_branch_assignment.end_date),
          ),
        );

      await db.insert(employee_branch_assignment).values(
        validatedBranchIds.map((branchId) => ({
          employee_user_id: params.userId,
          branch_id: branchId,
          start_date: today,
          end_date: null,
        })),
      );
    }
  } else if (needsSingleBranchAssignment) {
    const activeBranchIds = assignmentState.activeBranchAssignments.map((item) => item.branchId);
    const needsNewSingleBranch =
      activeBranchIds.length !== 1 || activeBranchIds[0] !== validatedBranchId;

    if (needsNewSingleBranch) {
      await db
        .update(employee_branch_assignment)
        .set({ end_date: today })
        .where(
          and(
            eq(employee_branch_assignment.employee_user_id, params.userId),
            isNull(employee_branch_assignment.end_date),
          ),
        );

      await db.insert(employee_branch_assignment).values({
        employee_user_id: params.userId,
        branch_id: validatedBranchId!,
        start_date: today,
        end_date: null,
      });
    }
  } else {
    await db
      .update(employee_branch_assignment)
      .set({ end_date: today })
      .where(
        and(
          eq(employee_branch_assignment.employee_user_id, params.userId),
          isNull(employee_branch_assignment.end_date),
        ),
      );
  }

  return { ok: true as const };
}

export async function updateManagedUserStatus(params: {
  scope: ManageUserAccountsScope;
  userId: string;
  nextStatus: "active" | "inactive";
}): Promise<ManagedUserMutationResult> {
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

  if (params.nextStatus === "inactive") {
    if (detail.roleName === "Collector") {
      const lifecycleBlock = await maybeBuildCollectorLifecycleBlock({
        actionType: "deactivate",
        collectorId: params.userId,
        currentRole: detail.roleName,
      });
      if (lifecycleBlock) {
        return lifecycleBlock;
      }
    }

    if (detail.roleName === "Borrower") {
      const liveBorrowerLoans = await countLiveBorrowerLoans(params.userId);
      if (liveBorrowerLoans > 0) {
        return {
          ok: false as const,
          message:
            "This borrower still has active or overdue loans and cannot be deactivated.",
        };
      }
    }
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

export async function deleteManagedUserAccount(
  scope: ManageUserAccountsScope,
  userId: string,
): Promise<ManagedUserMutationResult> {
  const detail = await loadManagedUserDetail(scope, userId);

  if (!detail) {
    return { ok: false as const, message: "User account not found in your scope." };
  }

  if (!detail.canDelete) {
    return { ok: false as const, message: "You are not allowed to delete this user account." };
  }

  if (detail.roleName === "Collector") {
    const lifecycleBlock = await maybeBuildCollectorLifecycleBlock({
      actionType: "delete",
      collectorId: userId,
      currentRole: detail.roleName,
    });
    if (lifecycleBlock) {
      return lifecycleBlock;
    }
  }

  if (detail.roleName === "Borrower") {
    const liveBorrowerLoans = await countLiveBorrowerLoans(userId);
    if (liveBorrowerLoans > 0) {
      return {
        ok: false as const,
        message:
          "This borrower still has active or overdue loans and cannot be deleted.",
      };
    }
  }

  const dependencyChecks = await Promise.all([
    db.select({ value: sql<number>`count(*)` }).from(loan_records).where(eq(loan_records.borrower_id, userId)).then((rows) => Number(rows[0]?.value) || 0).catch(() => 0),
    db.select({ value: sql<number>`count(*)` }).from(loan_records).where(eq(loan_records.collector_id, userId)).then((rows) => Number(rows[0]?.value) || 0).catch(() => 0),
    db.select({ value: sql<number>`count(*)` }).from(collections).where(eq(collections.collector_id, userId)).then((rows) => Number(rows[0]?.value) || 0).catch(() => 0),
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
