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
  expenses,
  incentive_payout_batches,
  incentive_rules,
  loan_records,
  roles,
  users,
} from "@/db/schema";
import type {
  BranchActionPermissions,
  BranchCreateMutationResult,
  BranchDetailAccessState,
  BranchAreasTabData,
  BranchAreaListRow,
  BranchMutationResult,
  BranchEmployeesTabData,
  BranchEmployeeListRow,
  BranchDetailOverviewData,
  BranchesAccessState,
  BranchNetworkCardData,
  BranchNetworkPageData,
} from "@/app/dashboard/branches/types";
import type { AnalyticsChartModel, AnalyticsChartRow } from "@/components/analytics/types";
import { buildBranchCode, normalizeBranchCodeInput } from "@/app/dashboard/branches/branch-code";

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

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
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
      status: branch.status,
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
    status: row.status,
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

export async function createBranch(params: {
  access: Extract<BranchesAccessState, { view: "network" }>;
  provinceName: string;
  provinceCode: string;
  municipalityName: string;
  municipalityCode: string;
  branchName: string;
  branchAddress: string;
}): Promise<BranchCreateMutationResult> {
  if (params.access.roleName !== "Admin" || !params.access.canCreateBranch) {
    return { ok: false, message: "Only Admin can create branches." };
  }

  const provinceName = params.provinceName.trim().slice(0, 100);
  const provinceCode = normalizeBranchCodeInput(params.provinceCode).slice(0, 20);
  const municipalityName = params.municipalityName.trim().slice(0, 100);
  const municipalityCode = normalizeBranchCodeInput(params.municipalityCode).slice(0, 20);
  const branchName = params.branchName.trim().slice(0, 100);
  const branchAddress = params.branchAddress.trim();

  if (!provinceName) {
    return { ok: false, message: "Province name is required." };
  }

  if (!provinceCode) {
    return { ok: false, message: "Province code is required." };
  }

  if (!/^[A-Z0-9-]{2,20}$/.test(provinceCode)) {
    return {
      ok: false,
      message: "Province code must use 2 to 20 uppercase letters, numbers, or hyphens only.",
    };
  }

  if (!municipalityName) {
    return { ok: false, message: "Municipality/City name is required." };
  }

  if (!municipalityCode) {
    return { ok: false, message: "Municipality/City code is required." };
  }

  if (!/^[A-Z0-9-]{2,20}$/.test(municipalityCode)) {
    return {
      ok: false,
      message: "Municipality/City code must use 2 to 20 uppercase letters, numbers, or hyphens only.",
    };
  }

  if (!branchName) {
    return { ok: false, message: "Branch name is required." };
  }

  if (!branchAddress) {
    return { ok: false, message: "Branch address is required." };
  }

  const branchCode = buildBranchCode(provinceCode, municipalityCode);
  if (!branchCode) {
    return { ok: false, message: "Branch code could not be generated from the provided location codes." };
  }

  const existingBranch = await db
    .select({ branchId: branch.branch_id })
    .from(branch)
    .where(eq(branch.branch_code, branchCode))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (existingBranch) {
    return {
      ok: false,
      message: `Branch code ${branchCode} already exists. Check the province and municipality codes before creating this branch.`,
    };
  }

  await db.insert(branch).values({
    province_name: provinceName,
    province_code: provinceCode,
    municipality_name: municipalityName,
    municipality_code: municipalityCode,
    branch_code: branchCode,
    branch_name: branchName,
    branch_address: branchAddress,
    status: "active",
  });

  return {
    ok: true,
    message: "Branch created.",
    branchCode,
  };
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
    status: branchCard.status,
    municipalityName: branchCard.municipalityName,
    provinceName: branchCard.provinceName,
    branchAddress: branchCard.branchAddress,
    dateCreated: branchCard.dateCreated,
    statusLabel: branchCard.status === "active" ? "Active" : "Inactive",
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

async function loadBranchMutationTarget(
  access: Extract<BranchDetailAccessState, { view: "detail" }>,
  branchCode: string,
) {
  const scopedWhere = buildBranchScopeWhere(access);
  const branchWhere = scopedWhere
    ? and(scopedWhere, eq(branch.branch_code, branchCode))
    : eq(branch.branch_code, branchCode);

  return db
    .select({
      branchId: branch.branch_id,
      branchCode: branch.branch_code,
      branchName: branch.branch_name,
      branchAddress: branch.branch_address,
      status: branch.status,
      municipalityName: branch.municipality_name,
      provinceName: branch.province_name,
    })
    .from(branch)
    .where(branchWhere)
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);
}

async function loadAreaMutationTarget(params: {
  access: Extract<BranchDetailAccessState, { view: "detail" }>;
  branchCode: string;
  areaId: number;
}) {
  const branchTarget = await loadBranchMutationTarget(params.access, params.branchCode);
  if (!branchTarget) {
    return null;
  }

  const areaRow = await db
    .select({
      areaId: areas.area_id,
      areaCode: areas.area_code,
      areaNo: areas.area_no,
      description: areas.description,
      status: areas.status,
    })
    .from(areas)
    .where(and(eq(areas.area_id, params.areaId), eq(areas.branch_id, branchTarget.branchId)))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!areaRow) {
    return null;
  }

  return {
    branch: branchTarget,
    area: areaRow,
  };
}

export function resolveBranchActionPermissions(
  access: Extract<BranchDetailAccessState, { view: "detail" }>,
): BranchActionPermissions {
  return {
    canEditDetails: access.roleName === "Admin" || access.roleName === "Branch Manager",
    canManageLifecycle: access.roleName === "Admin",
    canDelete: access.roleName === "Admin",
    canManageEmployees: access.roleName === "Admin" || access.roleName === "Branch Manager",
    canManageAreas: access.roleName === "Admin" || access.roleName === "Branch Manager",
  };
}

export async function createAreaByBranchCode(params: {
  access: Extract<BranchDetailAccessState, { view: "detail" }>;
  branchCode: string;
  areaNo: string;
  description: string;
}): Promise<BranchMutationResult> {
  const target = await loadBranchMutationTarget(params.access, params.branchCode);
  if (!target) {
    return { ok: false, message: "Branch not found in your allowed scope." };
  }

  if (params.access.roleName !== "Admin" && params.access.roleName !== "Branch Manager") {
    return { ok: false, message: "You are not allowed to create areas for this branch." };
  }

  if (target.status !== "active") {
    return { ok: false, message: "Areas cannot be created inside an inactive branch." };
  }

  const areaNo = params.areaNo.trim();
  const description = params.description.trim();
  const areaCode = `${target.branchCode}-${areaNo}`;

  if (!/^[0-9]{2}$/.test(areaNo)) {
    return { ok: false, message: "Area No. must use exactly two digits." };
  }

  const duplicateAreaNo = await db
    .select({ areaId: areas.area_id })
    .from(areas)
    .where(and(eq(areas.branch_id, target.branchId), eq(areas.area_no, areaNo)))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (duplicateAreaNo) {
    return { ok: false, message: `Area No. ${areaNo} already exists in this branch.` };
  }

  const duplicateAreaCode = await db
    .select({ areaId: areas.area_id })
    .from(areas)
    .where(eq(areas.area_code, areaCode))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (duplicateAreaCode) {
    return { ok: false, message: `Area Code ${areaCode} already exists.` };
  }

  try {
    await db.insert(areas).values({
      branch_id: target.branchId,
      area_no: areaNo,
      area_code: areaCode,
      description: description || null,
      status: "active",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("uq_areas_branch_area_no")) {
      return { ok: false, message: `Area No. ${areaNo} already exists in this branch.` };
    }

    if (message.includes("areas_area_code_key")) {
      return { ok: false, message: `Area Code ${areaCode} already exists.` };
    }

    return {
      ok: false,
      message: "The area could not be created due to a database error. Please try again.",
    };
  }

  return { ok: true, message: "Area created." };
}

export async function updateAreaByBranchCode(params: {
  access: Extract<BranchDetailAccessState, { view: "detail" }>;
  branchCode: string;
  areaId: number;
  description: string;
}): Promise<BranchMutationResult> {
  const target = await loadBranchMutationTarget(params.access, params.branchCode);
  if (!target) {
    return { ok: false, message: "Branch not found in your allowed scope." };
  }

  if (params.access.roleName !== "Admin" && params.access.roleName !== "Branch Manager") {
    return { ok: false, message: "You are not allowed to edit areas for this branch." };
  }
  const description = params.description.trim();

  const existingArea = await db
    .select({
      areaId: areas.area_id,
      areaCode: areas.area_code,
    })
    .from(areas)
    .where(and(eq(areas.area_id, params.areaId), eq(areas.branch_id, target.branchId)))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!existingArea) {
    return { ok: false, message: "Area not found in this branch." };
  }

  try {
    await db
      .update(areas)
      .set({
        description: description || null,
      })
      .where(eq(areas.area_id, existingArea.areaId));
  } catch {
    return {
      ok: false,
      message: "The area could not be updated due to a database error. Please try again.",
    };
  }

  return { ok: true, message: "Area updated." };
}

export async function updateAreaStatusByBranchCode(params: {
  access: Extract<BranchDetailAccessState, { view: "detail" }>;
  branchCode: string;
  areaId: number;
  nextStatus: "active" | "inactive";
}): Promise<BranchMutationResult> {
  const target = await loadAreaMutationTarget(params);
  if (!target) {
    return { ok: false, message: "Area not found in this branch." };
  }

  if (params.access.roleName !== "Admin" && params.access.roleName !== "Branch Manager") {
    return { ok: false, message: "You are not allowed to change area status for this branch." };
  }

  if (target.area.status === params.nextStatus) {
    return {
      ok: true,
      message:
        params.nextStatus === "active"
          ? "Area is already active."
          : "Area is already inactive.",
    };
  }

  await db
    .update(areas)
    .set({ status: params.nextStatus })
    .where(eq(areas.area_id, target.area.areaId));

  return {
    ok: true,
    message:
      params.nextStatus === "active"
        ? "Area reactivated. New assignments and new operational work can use this area again."
        : "Area deactivated. New assignments and new operational work are now blocked in this area while existing records remain visible.",
  };
}

export async function deleteAreaByBranchCode(params: {
  access: Extract<BranchDetailAccessState, { view: "detail" }>;
  branchCode: string;
  areaId: number;
}): Promise<BranchMutationResult> {
  const target = await loadAreaMutationTarget(params);
  if (!target) {
    return { ok: false, message: "Area not found in this branch." };
  }

  if (params.access.roleName !== "Admin" && params.access.roleName !== "Branch Manager") {
    return { ok: false, message: "You are not allowed to delete areas for this branch." };
  }

  const [activeCollectorAssignmentCount, assignmentHistoryCount, borrowerCount, loanCount] = await Promise.all([
    db
      .select({ value: sql<number>`count(*)` })
      .from(employee_area_assignment)
      .where(
        and(
          eq(employee_area_assignment.area_id, target.area.areaId),
          isNull(employee_area_assignment.end_date),
        ),
      )
      .then((rows) => Number(rows[0]?.value) || 0)
      .catch(() => 0),
    db
      .select({ value: sql<number>`count(*)` })
      .from(employee_area_assignment)
      .where(eq(employee_area_assignment.area_id, target.area.areaId))
      .then((rows) => Number(rows[0]?.value) || 0)
      .catch(() => 0),
    db
      .select({ value: sql<number>`count(*)` })
      .from(borrower_info)
      .where(eq(borrower_info.area_id, target.area.areaId))
      .then((rows) => Number(rows[0]?.value) || 0)
      .catch(() => 0),
    db
      .select({ value: sql<number>`count(*)` })
      .from(loan_records)
      .innerJoin(borrower_info, eq(borrower_info.user_id, loan_records.borrower_id))
      .where(eq(borrower_info.area_id, target.area.areaId))
      .then((rows) => Number(rows[0]?.value) || 0)
      .catch(() => 0),
  ]);

  const reasons: string[] = [];
  if (activeCollectorAssignmentCount > 0) {
    reasons.push(pluralize(activeCollectorAssignmentCount, "active collector assignment"));
  }
  if (borrowerCount > 0) {
    reasons.push(pluralize(borrowerCount, "borrower account"));
  }
  if (loanCount > 0) {
    reasons.push(pluralize(loanCount, "loan record"));
  }
  if (assignmentHistoryCount > 0 && activeCollectorAssignmentCount === 0) {
    reasons.push("collector assignment history");
  }

  if (reasons.length > 0) {
    return {
      ok: false,
      message: `This area cannot be deleted yet. It still has ${reasons.join(", ")}. Resolve or remove these dependencies before deleting the area.`,
    };
  }

  try {
    await db.delete(areas).where(eq(areas.area_id, target.area.areaId));
  } catch {
    return {
      ok: false,
      message: "This area still has linked operational records and cannot be deleted.",
    };
  }

  return { ok: true, message: "Area deleted." };
}

export async function updateBranchDetailsByCode(params: {
  access: Extract<BranchDetailAccessState, { view: "detail" }>;
  branchCode: string;
  branchName: string;
  branchAddress: string;
}): Promise<BranchMutationResult> {
  const target = await loadBranchMutationTarget(params.access, params.branchCode);
  if (!target) {
    return { ok: false, message: "Branch not found in your allowed scope." };
  }

  if (params.access.roleName !== "Admin" && params.access.roleName !== "Branch Manager") {
    return { ok: false, message: "You are not allowed to edit branch details." };
  }

  const branchName = params.branchName.trim();
  const branchAddress = params.branchAddress.trim();

  if (!branchName) {
    return { ok: false, message: "Branch name is required." };
  }

  if (!branchAddress) {
    return { ok: false, message: "Branch address is required." };
  }

  await db
    .update(branch)
    .set({
      branch_name: branchName,
      branch_address: branchAddress,
    })
    .where(eq(branch.branch_id, target.branchId));

  return { ok: true, message: "Branch details updated." };
}

export async function updateBranchStatusByCode(params: {
  access: Extract<BranchDetailAccessState, { view: "detail" }>;
  branchCode: string;
  nextStatus: "active" | "inactive";
}): Promise<BranchMutationResult> {
  const target = await loadBranchMutationTarget(params.access, params.branchCode);
  if (!target) {
    return { ok: false, message: "Branch not found in your allowed scope." };
  }

  if (params.access.roleName !== "Admin") {
    return { ok: false, message: "Only Admin can change branch lifecycle status." };
  }

  if (target.status === params.nextStatus) {
    return {
      ok: true,
      message: params.nextStatus === "active" ? "Branch is already active." : "Branch is already inactive.",
    };
  }

  await db
    .update(branch)
    .set({
      status: params.nextStatus,
    })
    .where(eq(branch.branch_id, target.branchId));

  return {
    ok: true,
    message:
      params.nextStatus === "active"
        ? "Branch reactivated. New accounts, loans, areas, and staffing assignments can be created here again."
        : "Branch deactivated. New accounts, loans, areas, and staffing assignments into this branch are now blocked while existing obligations remain visible.",
  };
}

export async function deleteBranchByCode(params: {
  access: Extract<BranchDetailAccessState, { view: "detail" }>;
  branchCode: string;
}): Promise<BranchMutationResult> {
  const target = await loadBranchMutationTarget(params.access, params.branchCode);
  if (!target) {
    return { ok: false, message: "Branch not found in your allowed scope." };
  }

  if (params.access.roleName !== "Admin") {
    return { ok: false, message: "Only Admin can delete branches." };
  }

  const [
    activeBranchEmployeeCount,
    activeCollectorCount,
    activeBorrowerCount,
    liveLoanCount,
    totalLoanCount,
    areaCount,
    expenseCount,
    incentiveRuleCount,
    payoutBatchCount,
  ] = await Promise.all([
    db
      .select({ value: sql<number>`count(*)` })
      .from(employee_branch_assignment)
      .innerJoin(users, eq(users.user_id, employee_branch_assignment.employee_user_id))
      .where(
        and(
          eq(employee_branch_assignment.branch_id, target.branchId),
          isNull(employee_branch_assignment.end_date),
          eq(users.status, "active"),
        ),
      )
      .then((rows) => Number(rows[0]?.value) || 0)
      .catch(() => 0),
    db
      .select({ value: sql<number>`count(distinct ${employee_area_assignment.employee_user_id})` })
      .from(employee_area_assignment)
      .innerJoin(areas, eq(areas.area_id, employee_area_assignment.area_id))
      .innerJoin(users, eq(users.user_id, employee_area_assignment.employee_user_id))
      .where(
        and(
          eq(areas.branch_id, target.branchId),
          isNull(employee_area_assignment.end_date),
          eq(users.status, "active"),
        ),
      )
      .then((rows) => Number(rows[0]?.value) || 0)
      .catch(() => 0),
    db
      .select({ value: sql<number>`count(distinct ${borrower_info.user_id})` })
      .from(borrower_info)
      .innerJoin(areas, eq(areas.area_id, borrower_info.area_id))
      .innerJoin(users, eq(users.user_id, borrower_info.user_id))
      .where(and(eq(areas.branch_id, target.branchId), eq(users.status, "active")))
      .then((rows) => Number(rows[0]?.value) || 0)
      .catch(() => 0),
    db
      .select({ value: sql<number>`count(*)` })
      .from(loan_records)
      .where(and(eq(loan_records.branch_id, target.branchId), inArray(loan_records.status, ["Active", "Overdue"])))
      .then((rows) => Number(rows[0]?.value) || 0)
      .catch(() => 0),
    db
      .select({ value: sql<number>`count(*)` })
      .from(loan_records)
      .where(eq(loan_records.branch_id, target.branchId))
      .then((rows) => Number(rows[0]?.value) || 0)
      .catch(() => 0),
    db
      .select({ value: sql<number>`count(*)` })
      .from(areas)
      .where(eq(areas.branch_id, target.branchId))
      .then((rows) => Number(rows[0]?.value) || 0)
      .catch(() => 0),
    db
      .select({ value: sql<number>`count(*)` })
      .from(expenses)
      .where(eq(expenses.branch_id, target.branchId))
      .then((rows) => Number(rows[0]?.value) || 0)
      .catch(() => 0),
    db
      .select({ value: sql<number>`count(*)` })
      .from(incentive_rules)
      .where(eq(incentive_rules.branch_id, target.branchId))
      .then((rows) => Number(rows[0]?.value) || 0)
      .catch(() => 0),
    db
      .select({ value: sql<number>`count(*)` })
      .from(incentive_payout_batches)
      .where(eq(incentive_payout_batches.branch_id, target.branchId))
      .then((rows) => Number(rows[0]?.value) || 0)
      .catch(() => 0),
  ]);

  const reasons: string[] = [];

  const activeEmployeeCount = activeBranchEmployeeCount + activeCollectorCount;
  if (activeEmployeeCount > 0) {
    reasons.push(`${pluralize(activeEmployeeCount, "active employee assignment")}`);
  }
  if (activeBorrowerCount > 0) {
    reasons.push(`${pluralize(activeBorrowerCount, "active borrower account")}`);
  }
  if (liveLoanCount > 0) {
    reasons.push(`${pluralize(liveLoanCount, "active or overdue loan")}`);
  }
  if (areaCount > 0) {
    reasons.push(`${pluralize(areaCount, "area attached to it", "areas attached to it")}`);
  }
  if (totalLoanCount > 0) {
    reasons.push(`${pluralize(totalLoanCount, "loan record")}`);
  }
  if (expenseCount > 0) {
    reasons.push(`${pluralize(expenseCount, "expense record")}`);
  }
  if (incentiveRuleCount > 0 || payoutBatchCount > 0) {
    reasons.push("linked incentive records");
  }

  if (reasons.length > 0) {
    return {
      ok: false,
      message: `This branch cannot be deleted yet. It still has ${reasons.join(", ")}. Resolve or remove these dependencies before deleting the branch.`,
    };
  }

  try {
    await db.delete(branch).where(eq(branch.branch_id, target.branchId));
    return { ok: true, message: "Branch deleted." };
  } catch {
    return {
      ok: false,
      message: "This branch still has linked operational records and cannot be deleted.",
    };
  }
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
          eq(users.status, "active"),
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
          eq(users.status, "active"),
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
      canView: true,
      canEdit: access.roleName === "Admin" || row.roleName === "Secretary",
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
      canView: true,
      canEdit: access.roleName === "Admin" || access.roleName === "Branch Manager",
    })),
  ];

  return {
    branchCode: branchCodeLabel,
    employees: rows,
  };
}

export async function loadBranchAreasTabDataByCode(
  access: Extract<BranchDetailAccessState, { view: "detail" }>,
  branchCode: string,
): Promise<BranchAreasTabData | null> {
  const branchCard = await loadBranchNetworkCardByCode(access, branchCode);
  if (!branchCard) {
    return null;
  }

  const branchId = branchCard.branchId;
  const { start, next } = monthWindow();

  const areaRows = await db
    .select({
      areaId: areas.area_id,
      areaNo: areas.area_no,
      areaCode: areas.area_code,
      description: areas.description,
      status: areas.status,
      dateCreated: areas.date_created,
    })
    .from(areas)
    .where(eq(areas.branch_id, branchId))
    .orderBy(asc(areas.area_no), asc(areas.area_code))
    .catch(() => []);

  if (areaRows.length === 0) {
    return {
      branchCode: branchCard.branchCode,
      areas: [],
    };
  }

  const areaIds = areaRows.map((row) => row.areaId);

  const [collectorRows, borrowerCountRows, loanCountRows, collectionTotalRows] = await Promise.all([
    db
      .select({
        areaId: employee_area_assignment.area_id,
        firstName: employee_info.first_name,
        middleName: employee_info.middle_name,
        lastName: employee_info.last_name,
      })
      .from(employee_area_assignment)
      .innerJoin(users, eq(users.user_id, employee_area_assignment.employee_user_id))
      .innerJoin(employee_info, eq(employee_info.user_id, users.user_id))
      .innerJoin(roles, eq(roles.role_id, users.role_id))
      .where(
        and(
          inArray(employee_area_assignment.area_id, areaIds),
          isNull(employee_area_assignment.end_date),
          eq(roles.role_name, "Collector"),
        ),
      )
      .orderBy(asc(employee_info.last_name), asc(employee_info.first_name))
      .catch(() => []),
    db
      .select({
        areaId: borrower_info.area_id,
        count: sql<number>`count(distinct ${borrower_info.user_id})`,
      })
      .from(borrower_info)
      .innerJoin(users, eq(users.user_id, borrower_info.user_id))
      .where(and(inArray(borrower_info.area_id, areaIds), eq(users.status, "active")))
      .groupBy(borrower_info.area_id)
      .catch(() => []),
    db
      .select({
        areaId: borrower_info.area_id,
        activeLoanCount: sql<number>`sum(case when ${loan_records.status} = 'Active' then 1 else 0 end)`,
        overdueLoanCount: sql<number>`sum(case when ${loan_records.status} = 'Overdue' then 1 else 0 end)`,
      })
      .from(loan_records)
      .innerJoin(borrower_info, eq(borrower_info.user_id, loan_records.borrower_id))
      .where(inArray(borrower_info.area_id, areaIds))
      .groupBy(borrower_info.area_id)
      .catch(() => []),
    db
      .select({
        areaId: borrower_info.area_id,
        collectionsThisMonth: sql<number>`coalesce(sum(${collections.amount}), 0)`,
      })
      .from(collections)
      .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
      .innerJoin(borrower_info, eq(borrower_info.user_id, loan_records.borrower_id))
      .where(
        and(
          inArray(borrower_info.area_id, areaIds),
          gte(collections.collection_date, start),
          lt(collections.collection_date, next),
        ),
      )
      .groupBy(borrower_info.area_id)
      .catch(() => []),
  ]);

  const collectorMap = new Map<number, string[]>();
  for (const row of collectorRows) {
    const nextName = formatFullName(row.firstName, row.middleName, row.lastName);
    const existing = collectorMap.get(row.areaId) ?? [];
    collectorMap.set(row.areaId, [...existing, nextName]);
  }

  const borrowerCountMap = new Map(borrowerCountRows.map((row) => [row.areaId, Number(row.count) || 0]));
  const loanCountMap = new Map(
    loanCountRows.map((row) => [
      row.areaId,
      {
        activeLoanCount: Number(row.activeLoanCount) || 0,
        overdueLoanCount: Number(row.overdueLoanCount) || 0,
      },
    ]),
  );
  const collectionTotalMap = new Map(
    collectionTotalRows.map((row) => [row.areaId, Number(row.collectionsThisMonth) || 0]),
  );

  const rows: BranchAreaListRow[] = areaRows.map((row) => {
    const assignedCollectorNames = collectorMap.get(row.areaId) ?? [];

    return {
      areaId: row.areaId,
      areaCode: row.areaCode,
      areaNo: row.areaNo,
      description: row.description ?? null,
      status: row.status,
      assignedCollectorLabel:
        assignedCollectorNames.length > 0 ? assignedCollectorNames.join(", ") : "Unassigned",
      assignedCollectorNames,
      borrowerCount: borrowerCountMap.get(row.areaId) ?? 0,
      activeLoanCount: loanCountMap.get(row.areaId)?.activeLoanCount ?? 0,
      overdueLoanCount: loanCountMap.get(row.areaId)?.overdueLoanCount ?? 0,
      collectionsThisMonth: collectionTotalMap.get(row.areaId) ?? 0,
      dateCreated: row.dateCreated,
    };
  });

  return {
    branchCode: branchCard.branchCode,
    areas: rows,
  };
}
