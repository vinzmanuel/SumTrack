import "server-only";

import { and, asc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  areas,
  borrower_info,
  branch,
  collections,
  employee_area_assignment,
  employee_branch_assignment,
  employee_info,
  loan_records,
  roles,
  users,
} from "@/db/schema";
import type {
  BranchDetailAccessState,
  BranchEmployeesTabData,
  BranchEmployeeListRow,
  BranchDetailOverviewData,
  BranchesAccessState,
  BranchNetworkCardData,
  BranchNetworkPageData,
} from "@/app/dashboard/branches/types";
import type { AnalyticsChartModel, AnalyticsChartRow } from "@/components/analytics/types";

function buildBranchScopeWhere(
  access:
    | Extract<BranchesAccessState, { view: "network" }>
    | Extract<BranchDetailAccessState, { view: "detail" }>,
) {
  if (access.roleName === "Admin") {
    return undefined;
  }

  if (access.allowedBranchIds.length === 0) {
    return eq(branch.branch_id, -1);
  }

  return inArray(branch.branch_id, access.allowedBranchIds);
}

function monthWindow() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    start: start.toISOString().slice(0, 10),
    next: next.toISOString().slice(0, 10),
  };
}

function lastSixMonthBuckets() {
  const buckets: Array<{ key: string; label: string; start: string; end: string }> = [];
  const now = new Date();

  for (let offset = 5; offset >= 0; offset -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    const label = start.toLocaleDateString("en-PH", { month: "short", year: "2-digit" });

    buckets.push({
      key,
      label,
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    });
  }

  return buckets;
}

function formatFullName(firstName: string | null, middleName: string | null, lastName: string | null) {
  return [firstName, middleName, lastName].filter(Boolean).join(" ").trim() || "Unassigned";
}

function branchScopedEmployeeRoleNames() {
  return ["Branch Manager", "Secretary", "Auditor"] as const;
}

async function loadBranchSummaryCards(
  access:
    | Extract<BranchesAccessState, { view: "network" }>
    | Extract<BranchDetailAccessState, { view: "detail" }>,
  targetBranchIds?: number[],
) {
  const scopedWhere = buildBranchScopeWhere(access);
  const targetWhere =
    targetBranchIds && targetBranchIds.length > 0 ? inArray(branch.branch_id, targetBranchIds) : undefined;
  const branchWhere = scopedWhere && targetWhere ? and(scopedWhere, targetWhere) : targetWhere ?? scopedWhere;

  const branchRows = await db
    .select({
      branchId: branch.branch_id,
      branchName: branch.branch_name,
      branchCode: branch.branch_code,
      municipalityName: branch.municipality_name,
      provinceName: branch.province_name,
      branchAddress: branch.branch_address,
      dateCreated: branch.date_created,
    })
    .from(branch)
    .where(branchWhere)
    .orderBy(asc(branch.branch_name))
    .catch(() => []);

  if (branchRows.length === 0) {
    return [];
  }

  const branchIds = branchRows.map((row) => row.branchId);
  const { start, next } = monthWindow();

  const [
    branchManagerRows,
    collectorCounts,
    borrowerCounts,
    loanCounts,
    collectionTotals,
  ] = await Promise.all([
    db
      .select({
        branchId: employee_branch_assignment.branch_id,
        companyId: users.company_id,
        firstName: employee_info.first_name,
        middleName: employee_info.middle_name,
        lastName: employee_info.last_name,
      })
      .from(employee_branch_assignment)
      .innerJoin(users, eq(users.user_id, employee_branch_assignment.employee_user_id))
      .innerJoin(employee_info, eq(employee_info.user_id, users.user_id))
      .innerJoin(roles, eq(roles.role_id, users.role_id))
      .where(
        and(
          inArray(employee_branch_assignment.branch_id, branchIds),
          isNull(employee_branch_assignment.end_date),
          eq(roles.role_name, "Branch Manager"),
          eq(users.status, "active"),
        ),
      )
      .catch(() => []),
    db
      .select({
        branchId: areas.branch_id,
        count: sql<number>`count(distinct ${employee_area_assignment.employee_user_id})`,
      })
      .from(employee_area_assignment)
      .innerJoin(areas, eq(areas.area_id, employee_area_assignment.area_id))
      .innerJoin(users, eq(users.user_id, employee_area_assignment.employee_user_id))
      .innerJoin(roles, eq(roles.role_id, users.role_id))
      .where(
        and(
          inArray(areas.branch_id, branchIds),
          isNull(employee_area_assignment.end_date),
          eq(roles.role_name, "Collector"),
          eq(users.status, "active"),
        ),
      )
      .groupBy(areas.branch_id)
      .catch(() => []),
    db
      .select({
        branchId: areas.branch_id,
        count: sql<number>`count(distinct ${borrower_info.user_id})`,
      })
      .from(borrower_info)
      .innerJoin(users, eq(users.user_id, borrower_info.user_id))
      .innerJoin(areas, eq(areas.area_id, borrower_info.area_id))
      .where(and(inArray(areas.branch_id, branchIds), eq(users.status, "active")))
      .groupBy(areas.branch_id)
      .catch(() => []),
    db
      .select({
        branchId: loan_records.branch_id,
        activeLoanCount: sql<number>`sum(case when ${loan_records.status} = 'Active' then 1 else 0 end)`,
        overdueLoanCount: sql<number>`sum(case when ${loan_records.status} = 'Overdue' then 1 else 0 end)`,
      })
      .from(loan_records)
      .where(inArray(loan_records.branch_id, branchIds))
      .groupBy(loan_records.branch_id)
      .catch(() => []),
    db
      .select({
        branchId: loan_records.branch_id,
        collectionsThisMonth: sql<number>`coalesce(sum(${collections.amount}), 0)`,
      })
      .from(collections)
      .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
      .where(
        and(
          inArray(loan_records.branch_id, branchIds),
          gte(collections.collection_date, start),
          lt(collections.collection_date, next),
        ),
      )
      .groupBy(loan_records.branch_id)
      .catch(() => []),
  ]);

  const managerMap = new Map<number, { managerName: string; companyId: string | null }>();
  for (const row of branchManagerRows) {
    if (!managerMap.has(row.branchId)) {
      managerMap.set(row.branchId, {
        managerName: formatFullName(row.firstName, row.middleName, row.lastName),
        companyId: row.companyId ?? null,
      });
    }
  }

  const collectorCountMap = new Map(collectorCounts.map((row) => [row.branchId, Number(row.count) || 0]));
  const borrowerCountMap = new Map(borrowerCounts.map((row) => [row.branchId, Number(row.count) || 0]));
  const loanCountMap = new Map(
    loanCounts.map((row) => [
      row.branchId,
      {
        activeLoanCount: Number(row.activeLoanCount) || 0,
        overdueLoanCount: Number(row.overdueLoanCount) || 0,
      },
    ]),
  );
  const collectionTotalMap = new Map(
    collectionTotals.map((row) => [row.branchId, Number(row.collectionsThisMonth) || 0]),
  );

  return branchRows.map<BranchNetworkCardData>((row) => ({
    branchId: row.branchId,
    branchName: row.branchName,
    branchCode: row.branchCode,
    municipalityName: row.municipalityName,
    provinceName: row.provinceName,
    branchAddress: row.branchAddress,
    managerName: managerMap.get(row.branchId)?.managerName ?? null,
    managerCompanyId: managerMap.get(row.branchId)?.companyId ?? null,
    collectorCount: collectorCountMap.get(row.branchId) ?? 0,
    borrowerCount: borrowerCountMap.get(row.branchId) ?? 0,
    activeLoanCount: loanCountMap.get(row.branchId)?.activeLoanCount ?? 0,
    overdueLoanCount: loanCountMap.get(row.branchId)?.overdueLoanCount ?? 0,
    collectionsThisMonth: collectionTotalMap.get(row.branchId) ?? 0,
    dateCreated: row.dateCreated,
  }));
}

export async function loadBranchNetworkPageData(
  access: Extract<BranchesAccessState, { view: "network" }>,
): Promise<BranchNetworkPageData> {
  const branches = await loadBranchSummaryCards(access);

  return {
    branches,
    totalCount: branches.length,
    canCreateBranch: access.canCreateBranch,
    scopeMessage: access.scopeMessage,
  };
}

export async function loadBranchNetworkCardByCode(
  access:
    | Extract<BranchesAccessState, { view: "network" }>
    | Extract<BranchDetailAccessState, { view: "detail" }>,
  branchCode: string,
) {
  const scopedWhere = buildBranchScopeWhere(access);
  const branchWhere = scopedWhere
    ? and(scopedWhere, eq(branch.branch_code, branchCode))
    : eq(branch.branch_code, branchCode);

  const branchId = await db
    .select({ branchId: branch.branch_id })
    .from(branch)
    .where(branchWhere)
    .limit(1)
    .then((rows) => rows[0]?.branchId ?? null)
    .catch(() => null);

  if (!branchId) {
    return null;
  }

  const branchCards = await loadBranchSummaryCards(access, [branchId]);
  return branchCards[0] ?? null;
}

export async function loadBranchCodeById(branchId: number): Promise<string | null> {
  return db
    .select({ branchCode: branch.branch_code })
    .from(branch)
    .where(eq(branch.branch_id, branchId))
    .limit(1)
    .then((rows) => rows[0]?.branchCode ?? null)
    .catch(() => null);
}

function buildCollectionsTrendChart(rows: AnalyticsChartRow[]): AnalyticsChartModel {
  return {
    rows,
    series: [
      {
        key: "collections",
        label: "Collections",
        color: "#16a34a",
      },
    ],
    noData: rows.every((row) => Number(row.values.collections ?? 0) === 0),
  };
}

export async function loadBranchDetailOverviewByCode(
  access: Extract<BranchDetailAccessState, { view: "detail" }>,
  branchCode: string,
): Promise<BranchDetailOverviewData | null> {
  const branchCard = await loadBranchNetworkCardByCode(access, branchCode);
  if (!branchCard) {
    return null;
  }

  const branchId = branchCard.branchId;
  const monthBuckets = lastSixMonthBuckets();
  const { start, next } = monthWindow();

  const [
    leadershipRows,
    branchAssignedRoleCounts,
    activeAreaCountRow,
    collectionsTrendRows,
  ] = await Promise.all([
    db
      .select({
        roleName: roles.role_name,
        companyId: users.company_id,
        firstName: employee_info.first_name,
        middleName: employee_info.middle_name,
        lastName: employee_info.last_name,
      })
      .from(employee_branch_assignment)
      .innerJoin(users, eq(users.user_id, employee_branch_assignment.employee_user_id))
      .innerJoin(employee_info, eq(employee_info.user_id, users.user_id))
      .innerJoin(roles, eq(roles.role_id, users.role_id))
      .where(
        and(
          eq(employee_branch_assignment.branch_id, branchId),
          isNull(employee_branch_assignment.end_date),
          inArray(roles.role_name, ["Branch Manager", "Auditor", "Secretary"]),
          eq(users.status, "active"),
        ),
      )
      .catch(() => []),
    db
      .select({
        roleName: roles.role_name,
        count: sql<number>`count(*)`,
      })
      .from(employee_branch_assignment)
      .innerJoin(users, eq(users.user_id, employee_branch_assignment.employee_user_id))
      .innerJoin(roles, eq(roles.role_id, users.role_id))
      .where(
        and(
          eq(employee_branch_assignment.branch_id, branchId),
          isNull(employee_branch_assignment.end_date),
          inArray(roles.role_name, ["Branch Manager", "Auditor", "Secretary"]),
          eq(users.status, "active"),
        ),
      )
      .groupBy(roles.role_name)
      .catch(() => []),
    db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(areas)
      .where(eq(areas.branch_id, branchId))
      .limit(1)
      .then((rows) => rows[0] ?? { count: 0 })
      .catch(() => ({ count: 0 })),
    Promise.all(
      monthBuckets.map(async (bucket) => {
        const row = await db
          .select({
            total: sql<number>`coalesce(sum(${collections.amount}), 0)`,
          })
          .from(collections)
          .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
          .where(
            and(
              eq(loan_records.branch_id, branchId),
              gte(collections.collection_date, bucket.start),
              lt(collections.collection_date, bucket.end),
            ),
          )
          .limit(1)
          .then((rows) => rows[0] ?? null)
          .catch(() => null);

        return {
          bucket: bucket.label,
          values: {
            collections: Number(row?.total) || 0,
          },
        } satisfies AnalyticsChartRow;
      }),
    ),
  ]);

  const managerRow = leadershipRows.find((row) => row.roleName === "Branch Manager") ?? null;
  const auditorRow = leadershipRows.find((row) => row.roleName === "Auditor") ?? null;

  const branchAssignedCountMap = new Map(
    branchAssignedRoleCounts.map((row) => [row.roleName, Number(row.count) || 0]),
  );

  const collectorCountRow = await db
    .select({
      count: sql<number>`count(distinct ${employee_area_assignment.employee_user_id})`,
    })
    .from(employee_area_assignment)
    .innerJoin(areas, eq(areas.area_id, employee_area_assignment.area_id))
    .innerJoin(users, eq(users.user_id, employee_area_assignment.employee_user_id))
    .innerJoin(roles, eq(roles.role_id, users.role_id))
    .where(
      and(
        eq(areas.branch_id, branchId),
        isNull(employee_area_assignment.end_date),
        eq(roles.role_name, "Collector"),
        eq(users.status, "active"),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? { count: 0 })
    .catch(() => ({ count: 0 }));

  const borrowerCountRow = await db
    .select({
      count: sql<number>`count(distinct ${borrower_info.user_id})`,
    })
    .from(borrower_info)
    .innerJoin(users, eq(users.user_id, borrower_info.user_id))
    .innerJoin(areas, eq(areas.area_id, borrower_info.area_id))
    .where(and(eq(areas.branch_id, branchId), eq(users.status, "active")))
    .limit(1)
    .then((rows) => rows[0] ?? { count: 0 })
    .catch(() => ({ count: 0 }));

  const loanMetricRow = await db
    .select({
      activeLoanCount: sql<number>`sum(case when ${loan_records.status} = 'Active' then 1 else 0 end)`,
      overdueLoanCount: sql<number>`sum(case when ${loan_records.status} = 'Overdue' then 1 else 0 end)`,
    })
    .from(loan_records)
    .where(eq(loan_records.branch_id, branchId))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  const collectionsThisMonthRow = await db
    .select({
      total: sql<number>`coalesce(sum(${collections.amount}), 0)`,
    })
    .from(collections)
    .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
    .where(
      and(
        eq(loan_records.branch_id, branchId),
        gte(collections.collection_date, start),
        lt(collections.collection_date, next),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  return {
    branchId: branchCard.branchId,
    branchName: branchCard.branchName,
    branchCode: branchCard.branchCode,
    municipalityName: branchCard.municipalityName,
    provinceName: branchCard.provinceName,
    branchAddress: branchCard.branchAddress,
    dateCreated: branchCard.dateCreated,
    statusLabel: "Active",
    managerName: managerRow
      ? formatFullName(managerRow.firstName, managerRow.middleName, managerRow.lastName)
      : null,
    managerCompanyId: managerRow?.companyId ?? null,
    auditorName: auditorRow
      ? formatFullName(auditorRow.firstName, auditorRow.middleName, auditorRow.lastName)
      : null,
    auditorCompanyId: auditorRow?.companyId ?? null,
    branchManagerCount: branchAssignedCountMap.get("Branch Manager") ?? 0,
    auditorCount: branchAssignedCountMap.get("Auditor") ?? 0,
    secretaryCount: branchAssignedCountMap.get("Secretary") ?? 0,
    collectorCount: Number(collectorCountRow.count) || 0,
    borrowerCount: Number(borrowerCountRow.count) || 0,
    activeAreaCount: Number(activeAreaCountRow.count) || 0,
    activeLoanCount: Number(loanMetricRow?.activeLoanCount) || 0,
    overdueLoanCount: Number(loanMetricRow?.overdueLoanCount) || 0,
    collectionsThisMonth: Number(collectionsThisMonthRow?.total) || 0,
    collectionsTrend: buildCollectionsTrendChart(collectionsTrendRows),
  };
}

export async function loadBranchEmployeesTabDataByCode(
  access: Extract<BranchDetailAccessState, { view: "detail" }>,
  branchCode: string,
): Promise<BranchEmployeesTabData | null> {
  const branchCard = await loadBranchNetworkCardByCode(access, branchCode);
  if (!branchCard) {
    return null;
  }

  const branchId = branchCard.branchId;
  const branchCodeLabel = branchCard.branchCode;
  const employeeRoleNames = branchScopedEmployeeRoleNames();

  const [branchAssignedRows, collectorRows] = await Promise.all([
    db
      .select({
        userId: users.user_id,
        companyId: users.company_id,
        status: users.status,
        contactNo: users.contact_no,
        email: users.email,
        roleName: roles.role_name,
        firstName: employee_info.first_name,
        middleName: employee_info.middle_name,
        lastName: employee_info.last_name,
      })
      .from(employee_branch_assignment)
      .innerJoin(users, eq(users.user_id, employee_branch_assignment.employee_user_id))
      .innerJoin(employee_info, eq(employee_info.user_id, users.user_id))
      .innerJoin(roles, eq(roles.role_id, users.role_id))
      .where(
        and(
          eq(employee_branch_assignment.branch_id, branchId),
          isNull(employee_branch_assignment.end_date),
          inArray(roles.role_name, [...employeeRoleNames]),
        ),
      )
      .orderBy(asc(roles.role_name), asc(employee_info.last_name), asc(employee_info.first_name))
      .catch(() => []),
    db
      .select({
        userId: users.user_id,
        companyId: users.company_id,
        status: users.status,
        contactNo: users.contact_no,
        email: users.email,
        roleName: roles.role_name,
        firstName: employee_info.first_name,
        middleName: employee_info.middle_name,
        lastName: employee_info.last_name,
        areaCode: areas.area_code,
      })
      .from(employee_area_assignment)
      .innerJoin(users, eq(users.user_id, employee_area_assignment.employee_user_id))
      .innerJoin(employee_info, eq(employee_info.user_id, users.user_id))
      .innerJoin(roles, eq(roles.role_id, users.role_id))
      .innerJoin(areas, eq(areas.area_id, employee_area_assignment.area_id))
      .where(
        and(
          eq(areas.branch_id, branchId),
          isNull(employee_area_assignment.end_date),
          eq(roles.role_name, "Collector"),
        ),
      )
      .orderBy(asc(employee_info.last_name), asc(employee_info.first_name))
      .catch(() => []),
  ]);

  const rows: BranchEmployeeListRow[] = [
    ...branchAssignedRows.map((row) => ({
      userId: row.userId,
      fullName: formatFullName(row.firstName, row.middleName, row.lastName),
      companyId: row.companyId,
      roleName: row.roleName,
      status: row.status,
      scopeLabel: branchCodeLabel,
      contactNo: row.contactNo,
      email: row.email,
    })),
    ...collectorRows.map((row) => ({
      userId: row.userId,
      fullName: formatFullName(row.firstName, row.middleName, row.lastName),
      companyId: row.companyId,
      roleName: row.roleName,
      status: row.status,
      scopeLabel: row.areaCode,
      contactNo: row.contactNo,
      email: row.email,
    })),
  ];

  return {
    branchCode: branchCodeLabel,
    employees: rows,
  };
}
