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
import { getAuditRequestContext } from "@/lib/audit/request-context";
import { logAuditEvent, logAuditEvents } from "@/lib/audit/logger";

const DEFAULT_MANAGE_USERS_PAGE_SIZE = 20;
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
const SORTED_FIRST_NAME_SQL = sql<string>`coalesce(${employee_info.first_name}, ${borrower_info.first_name}, '')`;
const SORTED_MIDDLE_NAME_SQL = sql<string>`coalesce(${employee_info.middle_name}, ${borrower_info.middle_name}, '')`;
const SORTED_LAST_NAME_SQL = sql<string>`coalesce(${employee_info.last_name}, ${borrower_info.last_name}, '')`;

type ActiveAssignmentState = {
  currentBranchId: number | null;
  currentBranchName: string | null;
  currentAreaId: number | null;
  currentAreaCode: string | null;
  currentAreaBranchId: number | null;
  currentBranchCode: string | null;
  activeBranchAssignments: { branchId: number; branchName: string; branchCode: string }[];
};

type HistoricalAssignmentState = {
  lastHeldBranchAssignments: { branchId: number; branchName: string; branchCode: string }[];
  lastHeldAreaId: number | null;
  lastHeldAreaCode: string | null;
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

function formatManagedUserDisplayName(
  firstName: string | null,
  middleName: string | null,
  lastName: string | null,
) {
  const safeFirstName = firstName?.trim();
  const safeMiddleName = middleName?.trim();
  const safeLastName = lastName?.trim();

  if (!safeFirstName && !safeMiddleName && !safeLastName) {
    return "N/A";
  }

  if (!safeMiddleName) {
    return [safeFirstName, safeLastName].filter(Boolean).join(" ").trim() || "N/A";
  }

  const middleInitial = safeMiddleName.charAt(0);
  return [safeFirstName, `${middleInitial}.`, safeLastName].filter(Boolean).join(" ").trim();
}

function buildManageUserAuditActor(scope: ManageUserAccountsScope) {
  return {
    type: "user" as const,
    userId: scope.viewerUserId,
    companyId: scope.viewerCompanyId,
    displayName: scope.viewerDisplayName,
    roleName: scope.roleName,
  };
}

function buildTargetUserAudit(detail: ManagedUserDetail) {
  return {
    userId: detail.userId,
    companyId: detail.companyId,
    displayName: detail.fullName,
  };
}

const BASIC_SELF_PROFILE_AUDIT_FIELDS = new Set([
  "first_name",
  "middle_name",
  "last_name",
  "contact_no",
  "email",
  "username",
]);

function shouldAuditAccountDetailsUpdate(params: {
  actorUserId: string;
  targetUserId: string;
  changedFields: string[];
}) {
  const isSelfEdit = params.actorUserId === params.targetUserId;

  if (!isSelfEdit) {
    return true;
  }

  return !params.changedFields.every((field) => BASIC_SELF_PROFILE_AUDIT_FIELDS.has(field));
}

function resolveAssignmentAuditBranchIds(params: {
  roleName: string;
  explicitBranchIds: number[];
  inferredBranchId: number | null;
}) {
  if (params.explicitBranchIds.length > 0) {
    return [...params.explicitBranchIds].sort((a, b) => a - b);
  }

  if (params.roleName === "Collector" && params.inferredBranchId !== null) {
    return [params.inferredBranchId];
  }

  return [];
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

  const useHistoricalAssignments = scope.selectedStatus === "inactive";
  const collectorAssignmentDateFilter = useHistoricalAssignments
    ? sql`${employee_area_assignment.end_date} is not null`
    : isNull(employee_area_assignment.end_date);
  const branchAssignmentDateFilter = useHistoricalAssignments
    ? sql`${employee_branch_assignment.end_date} is not null`
    : isNull(employee_branch_assignment.end_date);

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
          collectorAssignmentDateFilter,
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
          branchAssignmentDateFilter,
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
      activeCollectorMap: new Map<string, { scopeLabel: string }>(),
      lastCollectorMap: new Map<string, { scopeLabel: string }>(),
      activeEmployeeBranchMap: new Map<string, { scopeLabel: string }>(),
      lastEmployeeBranchMap: new Map<string, { scopeLabel: string }>(),
    };
  }

  const [
    borrowerRows,
    activeCollectorRows,
    historicalCollectorRows,
    activeEmployeeBranchRows,
    historicalEmployeeBranchRows,
  ] = await Promise.all([
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
        userId: employee_area_assignment.employee_user_id,
        areaCode: areas.area_code,
        endDate: employee_area_assignment.end_date,
      })
      .from(employee_area_assignment)
      .innerJoin(areas, eq(areas.area_id, employee_area_assignment.area_id))
      .where(
        and(
          inArray(employee_area_assignment.employee_user_id, userIds),
          sql`${employee_area_assignment.end_date} is not null`,
        ),
      )
      .orderBy(desc(employee_area_assignment.end_date), asc(areas.area_code))
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
    db
      .select({
        userId: employee_branch_assignment.employee_user_id,
        branchName: branch.branch_name,
        branchCode: branch.branch_code,
        endDate: employee_branch_assignment.end_date,
      })
      .from(employee_branch_assignment)
      .innerJoin(branch, eq(branch.branch_id, employee_branch_assignment.branch_id))
      .where(
        and(
          inArray(employee_branch_assignment.employee_user_id, userIds),
          sql`${employee_branch_assignment.end_date} is not null`,
        ),
      )
      .orderBy(desc(employee_branch_assignment.end_date), asc(branch.branch_name))
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

  const activeCollectorMap = new Map<string, { scopeLabel: string }>();
  for (const row of activeCollectorRows) {
    activeCollectorMap.set(row.userId, {
      scopeLabel: row.areaCode,
    });
  }

  const lastCollectorMap = new Map<string, { scopeLabel: string }>();
  const latestCollectorEndDateByUser = new Map<string, string>();
  for (const row of historicalCollectorRows) {
    if (!row.endDate) {
      continue;
    }

    const latestEndDate = latestCollectorEndDateByUser.get(row.userId);
    if (!latestEndDate) {
      latestCollectorEndDateByUser.set(row.userId, row.endDate);
      lastCollectorMap.set(row.userId, {
        scopeLabel: row.areaCode,
      });
      continue;
    }

    if (latestEndDate === row.endDate && !lastCollectorMap.has(row.userId)) {
      lastCollectorMap.set(row.userId, {
        scopeLabel: row.areaCode,
      });
    }
  }

  const activeEmployeeBranchMap = new Map<string, { scopeLabel: string }>();
  const groupedBranches = new Map<string, string[]>();
  for (const row of activeEmployeeBranchRows) {
    const current = groupedBranches.get(row.userId) ?? [];
    current.push(row.branchCode || row.branchName);
    groupedBranches.set(row.userId, current);
  }
  for (const [userId, labels] of groupedBranches.entries()) {
    activeEmployeeBranchMap.set(userId, {
      scopeLabel: labels.join(", "),
    });
  }

  const lastEmployeeBranchMap = new Map<string, { scopeLabel: string }>();
  const latestEndedBranchLabels = new Map<string, string[]>();
  const latestEndedBranchDateByUser = new Map<string, string>();
  for (const row of historicalEmployeeBranchRows) {
    if (!row.endDate) {
      continue;
    }

    const label = row.branchCode || row.branchName;
    const latestEndDate = latestEndedBranchDateByUser.get(row.userId);

    if (!latestEndDate) {
      latestEndedBranchDateByUser.set(row.userId, row.endDate);
      latestEndedBranchLabels.set(row.userId, [label]);
      continue;
    }

    if (latestEndDate === row.endDate) {
      const current = latestEndedBranchLabels.get(row.userId) ?? [];
      latestEndedBranchLabels.set(row.userId, [...current, label]);
    }
  }
  for (const [userId, labels] of latestEndedBranchLabels.entries()) {
    lastEmployeeBranchMap.set(userId, {
      scopeLabel: labels.join(", "),
    });
  }

  return {
    borrowerMap,
    activeCollectorMap,
    lastCollectorMap,
    activeEmployeeBranchMap,
    lastEmployeeBranchMap,
  };
}

function resolveScopePresentation(
  userId: string,
  roleName: string,
  status: "active" | "inactive",
  scopeMaps: Awaited<ReturnType<typeof loadScopeMaps>>,
) {
  if (roleName === "Admin") {
    return {
      scopeLabel: "Global",
      scopeContextLabel: status === "inactive" ? "Role retained; no assignment slot" : "Global scope",
    };
  }

  if (roleName === "Borrower") {
    return {
      scopeLabel: scopeMaps.borrowerMap.get(userId)?.scopeLabel ?? "Unassigned",
      scopeContextLabel: status === "inactive" ? "Borrower area on record" : "Current assignment",
    };
  }

  if (roleName === "Collector") {
    const currentScope = scopeMaps.activeCollectorMap.get(userId)?.scopeLabel ?? null;
    const lastHeldScope = scopeMaps.lastCollectorMap.get(userId)?.scopeLabel ?? null;

    if (status === "active" && !currentScope && lastHeldScope) {
      return {
        scopeLabel: "Unassigned",
        scopeContextLabel: `Last held assignment: ${lastHeldScope}`,
      };
    }

    const source = status === "active" ? scopeMaps.activeCollectorMap : scopeMaps.lastCollectorMap;
    return {
      scopeLabel: source.get(userId)?.scopeLabel ?? "Unassigned",
      scopeContextLabel: status === "active" ? "Current assignment" : "Last held assignment",
    };
  }

  const currentScope = scopeMaps.activeEmployeeBranchMap.get(userId)?.scopeLabel ?? null;
  const lastHeldScope = scopeMaps.lastEmployeeBranchMap.get(userId)?.scopeLabel ?? null;

  if (status === "active" && !currentScope && lastHeldScope) {
    return {
      scopeLabel: "Unassigned",
      scopeContextLabel: `Last held assignment: ${lastHeldScope}`,
    };
  }

  const source = status === "active" ? scopeMaps.activeEmployeeBranchMap : scopeMaps.lastEmployeeBranchMap;
  return {
    scopeLabel: source.get(userId)?.scopeLabel ?? "Unassigned",
    scopeContextLabel: status === "active" ? "Current assignment" : "Last held assignment",
  };
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

  if (scope.roleName === "Branch Manager" && row.roleName === "Secretary") {
    return ["Collector", "Secretary"];
  }

  return [];
}

function buildManageUserSortOrder(sort: ManageUserAccountsSort) {
  if (sort === "name_asc") {
    return [
      asc(SORTED_LAST_NAME_SQL),
      asc(SORTED_FIRST_NAME_SQL),
      asc(SORTED_MIDDLE_NAME_SQL),
      asc(users.company_id),
    ] as const;
  }

  if (sort === "name_desc") {
    return [
      desc(SORTED_LAST_NAME_SQL),
      desc(SORTED_FIRST_NAME_SQL),
      desc(SORTED_MIDDLE_NAME_SQL),
      asc(users.company_id),
    ] as const;
  }

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

async function loadLastHeldAssignmentState(userId: string): Promise<HistoricalAssignmentState> {
  const [lastEndedBranchDateRow, lastEndedAreaRow] = await Promise.all([
    db
      .select({
        endDate: employee_branch_assignment.end_date,
      })
      .from(employee_branch_assignment)
      .where(
        and(
          eq(employee_branch_assignment.employee_user_id, userId),
          sql`${employee_branch_assignment.end_date} is not null`,
        ),
      )
      .orderBy(desc(employee_branch_assignment.end_date))
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null),
    db
      .select({
        areaId: employee_area_assignment.area_id,
        areaCode: areas.area_code,
      })
      .from(employee_area_assignment)
      .innerJoin(areas, eq(areas.area_id, employee_area_assignment.area_id))
      .where(
        and(
          eq(employee_area_assignment.employee_user_id, userId),
          sql`${employee_area_assignment.end_date} is not null`,
        ),
      )
      .orderBy(desc(employee_area_assignment.end_date), asc(areas.area_code))
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null),
  ]);

  const lastHeldBranchAssignments = lastEndedBranchDateRow?.endDate
    ? await db
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
            eq(employee_branch_assignment.end_date, lastEndedBranchDateRow.endDate),
          ),
        )
        .orderBy(asc(branch.branch_name))
        .catch(() => [])
    : [];

  return {
    lastHeldBranchAssignments,
    lastHeldAreaId: lastEndedAreaRow?.areaId ?? null,
    lastHeldAreaCode: lastEndedAreaRow?.areaCode ?? null,
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
  const requestContext = await getAuditRequestContext();
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

  if (reassignedRows.length > 0) {
    await logAuditEvent({
      action: "loan.collector_changed",
      entityType: "loan",
      actor: buildManageUserAuditActor(params.scope),
      branchId: replacementCollector.branchId,
      branchScope: [replacementCollector.branchId],
      target: {
        userId: replacementCollector.userId,
        companyId: replacementCollector.companyId,
        displayName: replacementCollector.fullName,
      },
      description: `Reassigned ${reassignedRows.length} live loans from ${context.collectorName} to ${replacementCollector.fullName}.`,
      requestContext,
      metadata: {
        previousCollector: {
          userId: context.collectorId,
          companyId: context.collectorCompanyId,
          displayName: context.collectorName,
        },
        newCollector: {
          userId: replacementCollector.userId,
          companyId: replacementCollector.companyId,
          displayName: replacementCollector.fullName,
        },
        loanIds: reassignedRows.map((row) => row.loanId),
        actionType: context.actionType,
      },
    });
  }

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
        eq(users.status, "active"),
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
        eq(users.status, "active"),
        eq(roles.role_name, "Auditor"),
        ne(users.user_id, params.excludeUserId),
      ),
    )
    .catch(() => []);
}

async function findCollectorOverlapAreaIds(params: {
  areaIds: number[];
  excludeUserId?: string | null;
}) {
  if (params.areaIds.length === 0) {
    return new Set<number>();
  }

  const rows = await db
    .select({
      areaId: employee_area_assignment.area_id,
    })
    .from(employee_area_assignment)
    .innerJoin(users, eq(users.user_id, employee_area_assignment.employee_user_id))
    .innerJoin(roles, eq(roles.role_id, users.role_id))
    .where(
      and(
        inArray(employee_area_assignment.area_id, params.areaIds),
        isNull(employee_area_assignment.end_date),
        eq(users.status, "active"),
        eq(roles.role_name, "Collector"),
        params.excludeUserId ? ne(users.user_id, params.excludeUserId) : undefined,
      ),
    )
    .catch(() => []);

  return new Set(rows.map((row) => row.areaId));
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

  const pageSize = scope.pageSize || DEFAULT_MANAGE_USERS_PAGE_SIZE;
  const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1);
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * pageSize;

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
    .limit(pageSize)
    .offset(offset)
    .catch(() => []);

  return {
    totalCount,
    page,
    pageSize,
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
    const displayName = formatManagedUserDisplayName(firstName, middleName, lastName);
    const normalizedStatus = row.status as "active" | "inactive";
    const scopePresentation = resolveScopePresentation(row.userId, row.roleName, normalizedStatus, scopeMaps);

    return {
      userId: row.userId,
      fullName,
      displayName,
      companyId: row.companyId,
      username: row.username,
      dateCreated: row.dateCreated,
      roleName: row.roleName,
      scopeLabel: scopePresentation.scopeLabel,
      scopeContextLabel: normalizedStatus === "inactive" ? scopePresentation.scopeContextLabel : null,
      contactNo: row.contactNo,
      email: row.email,
      status: normalizedStatus,
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
    pageSize: baseRows.pageSize,
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
  const historicalAssignmentState = await loadLastHeldAssignmentState(userId);

  const scopeMaps = await loadScopeMaps([userId]);
  const isBorrower = row.roleName === "Borrower";
  const firstName = isBorrower ? row.borrowerFirstName : row.employeeFirstName;
  const middleName = isBorrower ? row.borrowerMiddleName : row.employeeMiddleName;
  const lastName = isBorrower ? row.borrowerLastName : row.employeeLastName;
  const editableRoleNames = resolveEditableRoleNames(scope, row);
  const normalizedStatus = row.status as "active" | "inactive";
  const isInactive = normalizedStatus === "inactive";
  const canEditAccount = canEditManagedUser(scope, row);
  const canManageStatus = canManageManagedUserStatus(scope, row);
  const canDelete = canDeleteManagedUser(scope, row);
  const canEditRole =
    canEditAccount &&
    !isInactive &&
    row.roleName !== "Borrower" &&
    ((scope.roleName === "Admin" && !isBorrower) ||
      (scope.roleName === "Branch Manager" &&
        (row.roleName === "Collector" || row.roleName === "Secretary")));
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
  const lastHeldBranchAssignments = historicalAssignmentState.lastHeldBranchAssignments.map((item) => ({
    branchId: item.branchId,
    branchName: item.branchName,
    branchCode: item.branchCode,
  }));
  const lastHeldAreaId = historicalAssignmentState.lastHeldAreaId;
  const lastHeldAreaCode = historicalAssignmentState.lastHeldAreaCode;
  const canEditBranchAssignment = canEditAccount && !isInactive && scope.roleName === "Admin" && !isBorrower;
  const canEditAuditorBranchAssignments =
    canEditAccount && !isInactive && scope.roleName === "Admin" && !isBorrower;
  const branchManagerBranchId = scope.allowedBranchIds[0] ?? null;
  const canEditAreaAssignment =
    canEditAccount &&
    !isInactive &&
    !isBorrower &&
    (scope.roleName === "Admin" ||
      (scope.roleName === "Branch Manager" &&
        (row.roleName === "Collector" || row.roleName === "Secretary") &&
        branchManagerBranchId !== null &&
        currentBranchId === branchManagerBranchId));
  const canLoadBranchAssignmentOptions =
    canEditAccount && !isBorrower && (scope.roleName === "Admin" || scope.roleName === "Branch Manager");
  const canLoadAreaAssignmentOptions =
    canEditAccount &&
    !isBorrower &&
    (scope.roleName === "Admin" ||
      (scope.roleName === "Branch Manager" &&
        branchManagerBranchId !== null &&
        currentBranchId === branchManagerBranchId &&
        (row.roleName === "Collector" || row.roleName === "Secretary")));
  const editableBranchOptions = canLoadBranchAssignmentOptions
    ? await db
        .select({
          branchId: branch.branch_id,
          branchName: branch.branch_name,
          branchCode: branch.branch_code,
        })
        .from(branch)
        .where(
          and(
            eq(branch.status, "active"),
            scope.roleName === "Branch Manager" && branchManagerBranchId !== null
              ? eq(branch.branch_id, branchManagerBranchId)
              : undefined,
          ),
        )
        .orderBy(asc(branch.branch_name))
        .catch(() => [])
    : [];
  const occupiedBranchManagerBranchIds =
    editableBranchOptions.length > 0
      ? new Set(
          (
            await db
              .select({
                branchId: employee_branch_assignment.branch_id,
              })
              .from(employee_branch_assignment)
              .innerJoin(users, eq(users.user_id, employee_branch_assignment.employee_user_id))
              .innerJoin(roles, eq(roles.role_id, users.role_id))
              .where(
                and(
                  inArray(
                    employee_branch_assignment.branch_id,
                    editableBranchOptions.map((item) => item.branchId),
                  ),
                  isNull(employee_branch_assignment.end_date),
                  eq(users.status, "active"),
                  eq(roles.role_name, "Branch Manager"),
                  ne(users.user_id, userId),
                ),
              )
              .catch(() => [])
          ).map((item) => item.branchId),
        )
      : new Set<number>();
  const occupiedAuditorBranchIds =
    editableBranchOptions.length > 0
      ? new Set(
          (
            await db
              .select({
                branchId: employee_branch_assignment.branch_id,
              })
              .from(employee_branch_assignment)
              .innerJoin(users, eq(users.user_id, employee_branch_assignment.employee_user_id))
              .innerJoin(roles, eq(roles.role_id, users.role_id))
              .where(
                and(
                  inArray(
                    employee_branch_assignment.branch_id,
                    editableBranchOptions.map((item) => item.branchId),
                  ),
                  isNull(employee_branch_assignment.end_date),
                  eq(users.status, "active"),
                  eq(roles.role_name, "Auditor"),
                  ne(users.user_id, userId),
                ),
              )
              .catch(() => [])
          ).map((item) => item.branchId),
        )
      : new Set<number>();
  const editableBranchOptionsWithOccupancy = editableBranchOptions.map((item) => ({
    ...item,
    hasActiveBranchManager: occupiedBranchManagerBranchIds.has(item.branchId),
    hasActiveAuditor: occupiedAuditorBranchIds.has(item.branchId),
  }));
  const editableAreaOptions = canLoadAreaAssignmentOptions
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
  const collectorOverlapAreaIds =
    editableAreaOptions.length > 0
      ? await findCollectorOverlapAreaIds({
          areaIds: editableAreaOptions.map((item) => item.areaId),
          excludeUserId: userId,
        })
      : new Set<number>();
  const editableAreaOptionsWithCollectorFlags = editableAreaOptions.map((item) => ({
    ...item,
    hasActiveCollector: collectorOverlapAreaIds.has(item.areaId),
  }));
  const scopePresentation = resolveScopePresentation(row.userId, row.roleName, normalizedStatus, scopeMaps);

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
    status: normalizedStatus,
    accountCategory: isBorrower ? "Borrower" : "Employee",
    scopeLabel: scopePresentation.scopeLabel,
    scopeContextLabel: scopePresentation.scopeContextLabel,
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
    canEdit: canEditAccount,
    canManageStatus,
    canDelete,
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
    lastHeldBranchAssignments,
    lastHeldAreaId,
    lastHeldAreaCode,
    editableBranchOptions: editableBranchOptionsWithOccupancy,
    editableAreaOptions: editableAreaOptionsWithCollectorFlags,
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
  const requestContext = await getAuditRequestContext();
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
  const isInactiveAccount = detail.status === "inactive";

  if (isInactiveAccount) {
    const hasStructuralChanges =
      nextRoleId !== detail.roleId ||
      params.branchId !== null ||
      params.areaId !== null ||
      requestedBranchIds.length > 0;

    if (hasStructuralChanges) {
      return {
        ok: false as const,
        message:
          "Reactivate this account before changing role or assignments. Previous placement is shown as historical context only.",
      };
    }
  }

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
    } else if (detail.roleName === "Secretary") {
      if (currentBranchId === null || managerBranchId === null || currentBranchId !== managerBranchId) {
        return {
          ok: false as const,
          message: "You can only manage secretaries assigned to your own branch.",
        };
      }
      if (!["Collector", "Secretary"].includes(nextRoleName)) {
        return {
          ok: false as const,
          message: "Branch Manager can only keep this account as Secretary or move it to Collector.",
        };
      }
      if (requestedBranchId !== currentBranchId) {
        return {
          ok: false as const,
          message: "Branch reassignment is not allowed in this edit flow.",
        };
      }
      if (nextRoleName !== "Collector" && params.areaId !== null && params.areaId !== currentAreaId) {
        return {
          ok: false as const,
          message: "Area reassignment is not allowed for this account in your edit flow.",
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
  let validatedAreaCode: string | null = null;
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
    validatedAreaCode = areaRow.areaCode;
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

  const roleRankOrder = ["Admin", "Auditor", "Branch Manager", "Secretary", "Collector", "Borrower"];
  const previousBranchIds = resolveAssignmentAuditBranchIds({
    roleName: detail.roleName,
    explicitBranchIds: assignmentState.activeBranchAssignments.map((item) => item.branchId),
    inferredBranchId: currentBranchId,
  });
  const nextBranchIdsRaw =
    nextRoleName === "Auditor"
      ? [...validatedBranchIds].sort((a, b) => a - b)
      : validatedBranchId !== null
        ? [validatedBranchId]
        : [];
  const nextBranchIds = resolveAssignmentAuditBranchIds({
    roleName: nextRoleName,
    explicitBranchIds: nextBranchIdsRaw,
    inferredBranchId: validatedBranchId ?? currentBranchId,
  });
  const endedBranchIds = previousBranchIds.filter((branchId) => !nextBranchIds.includes(branchId));
  const startedBranchIds = nextBranchIds.filter((branchId) => !previousBranchIds.includes(branchId));
  const areaEnded = currentAreaId !== null && currentAreaId !== validatedAreaId;
  const areaStarted = validatedAreaId !== null && currentAreaId !== validatedAreaId;
  const reassigned = endedBranchIds.length > 0 || startedBranchIds.length > 0 || areaEnded || areaStarted;
  const effectiveBranchScope = Array.from(
    new Set([...previousBranchIds, ...nextBranchIds, ...(validatedBranchId ? [validatedBranchId] : [])]),
  );
  const nextEmail = params.email || null;
  const nextContactNo = params.contactNo || null;
  const changedDetailFields = [
    detail.firstName !== params.firstName ? "first_name" : null,
    detail.middleName !== params.middleName ? "middle_name" : null,
    detail.lastName !== params.lastName ? "last_name" : null,
    (detail.email ?? null) !== nextEmail ? "email" : null,
    (detail.contactNo ?? null) !== nextContactNo ? "contact_no" : null,
  ].filter((field): field is string => field !== null);
  const detailsUpdated =
    changedDetailFields.length > 0;

  const auditEvents = [];

  if (
    detailsUpdated &&
    shouldAuditAccountDetailsUpdate({
      actorUserId: params.scope.viewerUserId,
      targetUserId: detail.userId,
      changedFields: changedDetailFields,
    })
  ) {
    auditEvents.push({
      action: "user.details_updated" as const,
      entityType: "user" as const,
      entityId: detail.userId,
      actor: buildManageUserAuditActor(params.scope),
      target: buildTargetUserAudit(detail),
      branchId: nextBranchIds[0] ?? currentBranchId,
      branchScope: effectiveBranchScope,
      description: `Updated account details for ${detail.fullName}.`,
      requestContext,
      metadata: {
        accountCategory: detail.accountCategory,
        old_values: {
          firstName: detail.firstName,
          middleName: detail.middleName,
          lastName: detail.lastName,
          email: detail.email,
          contactNo: detail.contactNo,
        },
        new_values: {
          firstName: params.firstName,
          middleName: params.middleName,
          lastName: params.lastName,
          email: nextEmail,
          contactNo: nextContactNo,
        },
      },
    });
  }

  if (roleChanged) {
    auditEvents.push({
      action: "user.role_changed" as const,
      entityType: "user" as const,
      entityId: detail.userId,
      actor: buildManageUserAuditActor(params.scope),
      target: buildTargetUserAudit(detail),
      branchId: nextBranchIds[0] ?? currentBranchId,
      branchScope: effectiveBranchScope,
      description: `Changed ${detail.fullName}'s role from ${detail.roleName} to ${nextRoleName}.`,
      requestContext,
      metadata: {
        old_values: { roleId: detail.roleId, roleName: detail.roleName },
        new_values: { roleId: nextRoleId, roleName: nextRoleName },
      },
    });

    if (roleRankOrder.indexOf(nextRoleName) >= 0 && roleRankOrder.indexOf(detail.roleName) >= 0) {
      if (roleRankOrder.indexOf(nextRoleName) < roleRankOrder.indexOf(detail.roleName)) {
        auditEvents.push({
          action: "user.promoted" as const,
          entityType: "user" as const,
          entityId: detail.userId,
          actor: buildManageUserAuditActor(params.scope),
          target: buildTargetUserAudit(detail),
          branchId: nextBranchIds[0] ?? currentBranchId,
          branchScope: effectiveBranchScope,
          description: `Promoted ${detail.fullName} from ${detail.roleName} to ${nextRoleName}.`,
          requestContext,
          metadata: {
            old_values: { roleName: detail.roleName },
            new_values: { roleName: nextRoleName },
          },
        });
      }
    }
  }

  for (const branchId of endedBranchIds) {
    auditEvents.push({
      action: "assignment.branch_ended" as const,
      entityType: "assignment" as const,
      entityId: detail.userId,
      actor: buildManageUserAuditActor(params.scope),
      target: buildTargetUserAudit(detail),
      branchId,
      branchScope: effectiveBranchScope,
      description: `Ended branch assignment for ${detail.fullName}.`,
      requestContext,
      metadata: {
        old_values: { branchId },
      },
    });
  }

  for (const branchId of startedBranchIds) {
    auditEvents.push({
      action: "assignment.branch_started" as const,
      entityType: "assignment" as const,
      entityId: detail.userId,
      actor: buildManageUserAuditActor(params.scope),
      target: buildTargetUserAudit(detail),
      branchId,
      branchScope: effectiveBranchScope,
      description: `Started branch assignment for ${detail.fullName}.`,
      requestContext,
      metadata: {
        new_values: { branchId },
      },
    });
  }

  if (areaEnded) {
    auditEvents.push({
      action: "assignment.area_ended" as const,
      entityType: "assignment" as const,
      entityId: detail.userId,
      actor: buildManageUserAuditActor(params.scope),
      target: buildTargetUserAudit(detail),
      branchId: currentBranchId,
      branchScope: effectiveBranchScope,
      description: `Ended area assignment for ${detail.fullName}.`,
      requestContext,
      metadata: {
        old_values: { areaId: currentAreaId, areaCode: detail.currentAreaCode },
      },
    });
  }

  if (areaStarted) {
    auditEvents.push({
      action: "assignment.area_started" as const,
      entityType: "assignment" as const,
      entityId: detail.userId,
      actor: buildManageUserAuditActor(params.scope),
      target: buildTargetUserAudit(detail),
      branchId: validatedBranchId,
      branchScope: effectiveBranchScope,
      description: `Started area assignment for ${detail.fullName}.`,
      requestContext,
      metadata: {
        new_values: { areaId: validatedAreaId, areaCode: validatedAreaCode },
      },
    });
  }

  if (reassigned) {
    auditEvents.push({
      action: "user.reassigned" as const,
      entityType: "user" as const,
      entityId: detail.userId,
      actor: buildManageUserAuditActor(params.scope),
      target: buildTargetUserAudit(detail),
      branchId: nextBranchIds[0] ?? validatedBranchId ?? currentBranchId,
      branchScope: effectiveBranchScope,
      description: `Reassigned ${detail.fullName}.`,
      requestContext,
      metadata: {
        old_values: {
          branchIds: previousBranchIds,
          areaId: currentAreaId,
          areaCode: detail.currentAreaCode,
        },
        new_values: {
          branchIds: nextBranchIds,
          areaId: validatedAreaId,
          areaCode: validatedAreaCode,
        },
      },
    });
  }

  if (auditEvents.length > 0) {
    await logAuditEvents(auditEvents);
  }

  return { ok: true as const };
}

export async function updateManagedUserStatus(params: {
  scope: ManageUserAccountsScope;
  userId: string;
  nextStatus: "active" | "inactive";
  roleId?: number | null;
  branchId?: number | null;
  branchIds?: number[];
  areaId?: number | null;
}): Promise<ManagedUserMutationResult> {
  const requestContext = await getAuditRequestContext();
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

  const requestedBranchIds = Array.from(
    new Set((params.branchIds ?? []).filter((value): value is number => Number.isFinite(value))),
  );
  const managerBranchId = params.scope.allowedBranchIds[0] ?? null;
  const editableRoleIds = new Set(detail.editableRoleOptions.map((item) => item.roleId ?? -1));
  const nextRoleId = params.nextStatus === "active" ? params.roleId ?? detail.roleId : detail.roleId;
  const nextRoleOption =
    detail.editableRoleOptions.find((item) => item.roleId === nextRoleId) ??
    (nextRoleId === detail.roleId ? { roleId: detail.roleId, roleName: detail.roleName } : null);
  const nextRoleName = nextRoleOption?.roleName ?? detail.roleName;

  if (detail.roleName === "Borrower" || nextRoleName === "Borrower") {
    if (nextRoleId !== detail.roleId) {
      return { ok: false as const, message: "Borrower accounts cannot be changed to another role." };
    }
  }

  if (nextRoleId !== detail.roleId && !editableRoleIds.has(nextRoleId)) {
    return { ok: false as const, message: "This role change is not allowed in the reactivation flow." };
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

  const statusTimestamp = new Date().toISOString();
  const assignmentEndDate = statusTimestamp.slice(0, 10);

  try {
    await db.transaction(async (tx) => {
      if (params.nextStatus === "inactive") {
        const [activeBranchAssignmentIds, activeAreaAssignmentIds] = await Promise.all([
        tx
          .select({ assignmentId: employee_branch_assignment.assignment_id })
          .from(employee_branch_assignment)
          .where(
            and(
              eq(employee_branch_assignment.employee_user_id, params.userId),
              isNull(employee_branch_assignment.end_date),
            ),
          )
          .then((rows) => rows.map((row) => row.assignmentId)),
        tx
          .select({ assignmentId: employee_area_assignment.assignment_id })
          .from(employee_area_assignment)
          .where(
            and(
              eq(employee_area_assignment.employee_user_id, params.userId),
              isNull(employee_area_assignment.end_date),
            ),
          )
          .then((rows) => rows.map((row) => row.assignmentId)),
      ]);

      if (activeBranchAssignmentIds.length > 0) {
        await tx
          .update(employee_branch_assignment)
          .set({ end_date: assignmentEndDate })
          .where(inArray(employee_branch_assignment.assignment_id, activeBranchAssignmentIds));
      }

      if (activeAreaAssignmentIds.length > 0) {
        await tx
          .update(employee_area_assignment)
          .set({ end_date: assignmentEndDate })
          .where(inArray(employee_area_assignment.assignment_id, activeAreaAssignmentIds));
      }
      }

      if (params.nextStatus === "active") {
      let validatedBranchId: number | null = null;
      let validatedAreaId: number | null = null;
      let validatedBranchIds: number[] = [];

      if (nextRoleName === "Collector") {
        if (!params.areaId) {
          throw new Error("Area assignment is required before reactivating this collector.");
        }

        const areaRow = await tx
          .select({
            areaId: areas.area_id,
            areaCode: areas.area_code,
            branchId: areas.branch_id,
            areaStatus: areas.status,
            branchStatus: branch.status,
          })
          .from(areas)
          .innerJoin(branch, eq(branch.branch_id, areas.branch_id))
          .where(eq(areas.area_id, params.areaId))
          .limit(1)
          .then((rows) => rows[0] ?? null);

        if (!areaRow) {
          throw new Error("Selected area was not found.");
        }

        if (params.scope.roleName === "Branch Manager" && managerBranchId !== areaRow.branchId) {
          throw new Error("You can only reactivate collectors into areas within your own branch.");
        }

        if (areaRow.branchStatus !== "active") {
          throw new Error("Inactive branches cannot receive collector assignments.");
        }

        if (areaRow.areaStatus !== "active") {
          throw new Error("Inactive areas cannot receive collector assignments.");
        }

        validatedAreaId = areaRow.areaId;
      } else if (nextRoleName === "Auditor") {
        if (params.scope.roleName !== "Admin") {
          throw new Error("Only Admin can reactivate auditor branch jurisdictions.");
        }

        if (requestedBranchIds.length === 0) {
          throw new Error("Select at least one branch before reactivating this auditor.");
        }

        const branchRows = await tx
          .select({
            branchId: branch.branch_id,
            status: branch.status,
          })
          .from(branch)
          .where(inArray(branch.branch_id, requestedBranchIds));

        if (branchRows.length !== requestedBranchIds.length) {
          throw new Error("One or more selected branches were not found.");
        }

        if (branchRows.some((item) => item.status !== "active")) {
          throw new Error("Inactive branches cannot receive auditor assignments.");
        }

        const conflictingAuditorAssignments = await findConflictingAuditorAssignments({
          branchIds: requestedBranchIds,
          excludeUserId: params.userId,
        });

        if (conflictingAuditorAssignments.length > 0) {
          const branchLabel = conflictingAuditorAssignments
            .map((item) => item.branchCode || item.branchName)
            .join(", ");
          throw new Error(
            `Each branch can only have one Auditor. Resolve the existing Auditor assignment for ${branchLabel} first.`,
          );
        }

        validatedBranchIds = requestedBranchIds;
      } else if (nextRoleName === "Branch Manager" || nextRoleName === "Secretary") {
        const effectiveBranchId =
          params.scope.roleName === "Branch Manager" ? managerBranchId : params.branchId ?? null;

        if (!effectiveBranchId) {
          throw new Error("Branch assignment is required before reactivating this account.");
        }

        const branchRow = await tx
          .select({
            branchId: branch.branch_id,
            status: branch.status,
          })
          .from(branch)
          .where(eq(branch.branch_id, effectiveBranchId))
          .limit(1)
          .then((rows) => rows[0] ?? null);

        if (!branchRow) {
          throw new Error("Selected branch was not found.");
        }

        if (params.scope.roleName === "Branch Manager" && managerBranchId !== branchRow.branchId) {
          throw new Error("You can only reactivate accounts within your own branch.");
        }

        if (branchRow.status !== "active") {
          throw new Error("Inactive branches cannot receive new assignments.");
        }

        if (nextRoleName === "Branch Manager") {
          const existingBranchManager = await findConflictingSingleBranchRoleAssignee({
            roleName: "Branch Manager",
            branchId: branchRow.branchId,
            excludeUserId: params.userId,
          });

          if (existingBranchManager) {
            throw new Error(
              `Each branch can only have one Branch Manager. ${formatFullName(existingBranchManager.firstName, existingBranchManager.middleName, existingBranchManager.lastName)} (${existingBranchManager.companyId}) is already assigned to ${existingBranchManager.branchName}.`,
            );
          }
        }

        validatedBranchId = branchRow.branchId;
      }

      // Legacy cleanup only: if an older inactive record still has open assignments,
      // end them now so reactivation never silently restores occupancy.
      const [legacyOpenBranchAssignmentIds, legacyOpenAreaAssignmentIds] = await Promise.all([
        tx
          .select({ assignmentId: employee_branch_assignment.assignment_id })
          .from(employee_branch_assignment)
          .where(
            and(
              eq(employee_branch_assignment.employee_user_id, params.userId),
              isNull(employee_branch_assignment.end_date),
            ),
          )
          .then((rows) => rows.map((row) => row.assignmentId)),
        tx
          .select({ assignmentId: employee_area_assignment.assignment_id })
          .from(employee_area_assignment)
          .where(
            and(
              eq(employee_area_assignment.employee_user_id, params.userId),
              isNull(employee_area_assignment.end_date),
            ),
          )
          .then((rows) => rows.map((row) => row.assignmentId)),
      ]);

      if (legacyOpenBranchAssignmentIds.length > 0) {
        await tx
          .update(employee_branch_assignment)
          .set({ end_date: assignmentEndDate })
          .where(inArray(employee_branch_assignment.assignment_id, legacyOpenBranchAssignmentIds));
      }

      if (legacyOpenAreaAssignmentIds.length > 0) {
        await tx
          .update(employee_area_assignment)
          .set({ end_date: assignmentEndDate })
          .where(inArray(employee_area_assignment.assignment_id, legacyOpenAreaAssignmentIds));
      }

      if (nextRoleName === "Collector" && validatedAreaId) {
        await tx.insert(employee_area_assignment).values({
          employee_user_id: params.userId,
          area_id: validatedAreaId,
          start_date: assignmentEndDate,
          end_date: null,
        });
      }

      if (nextRoleName === "Auditor" && validatedBranchIds.length > 0) {
        await tx.insert(employee_branch_assignment).values(
          validatedBranchIds.map((branchId) => ({
            employee_user_id: params.userId,
            branch_id: branchId,
            start_date: assignmentEndDate,
            end_date: null,
          })),
        );
      }

      if ((nextRoleName === "Branch Manager" || nextRoleName === "Secretary") && validatedBranchId) {
        await tx.insert(employee_branch_assignment).values({
          employee_user_id: params.userId,
          branch_id: validatedBranchId,
          start_date: assignmentEndDate,
          end_date: null,
        });
      }
      }

      await tx
        .update(users)
        .set({
          role_id: nextRoleId,
          status: params.nextStatus,
          updated_at: statusTimestamp,
        })
        .where(eq(users.user_id, params.userId));
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update account status right now.";
    return { ok: false as const, message };
  }

  const auditNextRoleName =
    (params.nextStatus === "active" &&
      (detail.editableRoleOptions.find((item) => item.roleId === (params.roleId ?? detail.roleId))?.roleName ??
        detail.roleName)) ||
    detail.roleName;
  const reactivatedBranchIds =
    auditNextRoleName === "Auditor"
      ? Array.from(new Set((params.branchIds ?? []).filter((value): value is number => Number.isFinite(value))))
      : params.branchId
        ? [params.branchId]
        : detail.currentBranchAssignments.map((item) => item.branchId);
  const roleRankOrder = ["Admin", "Auditor", "Branch Manager", "Secretary", "Collector", "Borrower"];
  const auditEvents = [];

  auditEvents.push({
    action: (params.nextStatus === "inactive" ? "user.deactivated" : "user.reactivated") as
      | "user.deactivated"
      | "user.reactivated",
    entityType: "user" as const,
    entityId: detail.userId,
    actor: buildManageUserAuditActor(params.scope),
    target: buildTargetUserAudit(detail),
    branchId: reactivatedBranchIds[0] ?? detail.currentBranchId,
    branchScope: Array.from(new Set([...detail.currentBranchAssignments.map((item) => item.branchId), ...reactivatedBranchIds])),
    description:
      params.nextStatus === "inactive"
        ? `Deactivated ${detail.fullName}.`
        : `Reactivated ${detail.fullName}.`,
    requestContext,
    metadata: {
      old_values: { status: detail.status, roleName: detail.roleName },
      new_values: { status: params.nextStatus, roleName: auditNextRoleName },
    },
  });

  if (params.nextStatus === "inactive") {
    for (const branchAssignment of detail.currentBranchAssignments) {
      auditEvents.push({
        action: "assignment.branch_ended" as const,
        entityType: "assignment" as const,
        entityId: detail.userId,
        actor: buildManageUserAuditActor(params.scope),
        target: buildTargetUserAudit(detail),
        branchId: branchAssignment.branchId,
        branchScope: detail.currentBranchAssignments.map((item) => item.branchId),
        description: `Ended branch assignment for ${detail.fullName} during deactivation.`,
        requestContext,
        metadata: {
          old_values: { branchId: branchAssignment.branchId, branchName: branchAssignment.branchName },
        },
      });
    }

    if (detail.currentAreaId) {
      auditEvents.push({
        action: "assignment.area_ended" as const,
        entityType: "assignment" as const,
        entityId: detail.userId,
        actor: buildManageUserAuditActor(params.scope),
        target: buildTargetUserAudit(detail),
        branchId: detail.currentBranchId,
        branchScope: detail.currentBranchAssignments.map((item) => item.branchId),
        description: `Ended area assignment for ${detail.fullName} during deactivation.`,
        requestContext,
        metadata: {
          old_values: { areaId: detail.currentAreaId, areaCode: detail.currentAreaCode },
        },
      });
    }
  } else {
    if (auditNextRoleName !== detail.roleName) {
      auditEvents.push({
        action: "user.role_changed" as const,
        entityType: "user" as const,
        entityId: detail.userId,
        actor: buildManageUserAuditActor(params.scope),
        target: buildTargetUserAudit(detail),
        branchId: reactivatedBranchIds[0] ?? detail.currentBranchId,
        branchScope: reactivatedBranchIds,
        description: `Changed ${detail.fullName}'s role from ${detail.roleName} to ${auditNextRoleName} during reactivation.`,
        requestContext,
        metadata: {
          old_values: { roleId: detail.roleId, roleName: detail.roleName },
          new_values: { roleId: params.roleId ?? detail.roleId, roleName: auditNextRoleName },
        },
      });

      if (roleRankOrder.indexOf(auditNextRoleName) < roleRankOrder.indexOf(detail.roleName)) {
        auditEvents.push({
          action: "user.promoted" as const,
          entityType: "user" as const,
          entityId: detail.userId,
          actor: buildManageUserAuditActor(params.scope),
          target: buildTargetUserAudit(detail),
          branchId: reactivatedBranchIds[0] ?? detail.currentBranchId,
          branchScope: reactivatedBranchIds,
          description: `Promoted ${detail.fullName} from ${detail.roleName} to ${auditNextRoleName} during reactivation.`,
          requestContext,
          metadata: {
            old_values: { roleName: detail.roleName },
            new_values: { roleName: auditNextRoleName },
          },
        });
      }
    }

    for (const branchId of reactivatedBranchIds) {
      auditEvents.push({
        action: "assignment.branch_started" as const,
        entityType: "assignment" as const,
        entityId: detail.userId,
        actor: buildManageUserAuditActor(params.scope),
        target: buildTargetUserAudit(detail),
        branchId,
        branchScope: reactivatedBranchIds,
        description: `Started branch assignment for ${detail.fullName} during reactivation.`,
        requestContext,
        metadata: {
          new_values: { branchId },
        },
      });
    }

    if (params.areaId) {
      auditEvents.push({
        action: "assignment.area_started" as const,
        entityType: "assignment" as const,
        entityId: detail.userId,
        actor: buildManageUserAuditActor(params.scope),
        target: buildTargetUserAudit(detail),
        branchId: params.branchId ?? detail.currentBranchId,
        branchScope: reactivatedBranchIds,
        description: `Started area assignment for ${detail.fullName} during reactivation.`,
        requestContext,
        metadata: {
          new_values: { areaId: params.areaId },
        },
      });
    }
  }

  await logAuditEvents(auditEvents);

  return { ok: true as const };
}

export async function deleteManagedUserAccount(
  scope: ManageUserAccountsScope,
  userId: string,
): Promise<ManagedUserMutationResult> {
  const requestContext = await getAuditRequestContext();
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
    db.select({ value: sql<number>`count(*)` }).from(loan_records).where(eq(loan_records.created_by, userId)).then((rows) => Number(rows[0]?.value) || 0).catch(() => 0),
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

  await logAuditEvent({
    action: "user.deleted",
    entityType: "user",
    entityId: detail.userId,
    actor: buildManageUserAuditActor(scope),
    target: buildTargetUserAudit(detail),
    branchId: detail.currentBranchId,
    branchScope: detail.currentBranchAssignments.map((item) => item.branchId),
    description: `Deleted ${detail.fullName}.`,
    requestContext,
    metadata: {
      accountCategory: detail.accountCategory,
      roleName: detail.roleName,
      companyId: detail.companyId,
      status: detail.status,
      currentBranchAssignments: detail.currentBranchAssignments.map((item) => ({
        branchId: item.branchId,
        branchCode: item.branchCode ?? null,
        branchName: item.branchName,
      })),
      currentAreaId: detail.currentAreaId,
      currentAreaCode: detail.currentAreaCode,
    },
  });

  return { ok: true as const };
}
