import { asc } from "drizzle-orm";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { getCurrentMonthValue, resolveActiveBranchForBranchManager, resolvePayPeriod } from "@/app/dashboard/incentives/lib";
import type { IncentivesAccessState, IncentivesFiltersState, IncentivesPageProps } from "@/app/dashboard/incentives/types";
import { db } from "@/db";
import { branch } from "@/db/schema";

function parseSelectedBranchRaw(value: string | undefined) {
  const trimmed = String(value ?? "all").trim();
  return /^\d+$/.test(trimmed) || trimmed === "all" ? trimmed : "all";
}

export function parseIncentivesFilters(
  params: Awaited<IncentivesPageProps["searchParams"]>,
): IncentivesFiltersState {
  const selectedMonthRaw = String(params?.month ?? getCurrentMonthValue());
  return {
    selectedMonthRaw,
    selectedBranchRaw: parseSelectedBranchRaw(params?.branch),
    payPeriod: resolvePayPeriod(selectedMonthRaw),
  };
}

export async function resolveIncentivesPageAccess(
  filters: IncentivesFiltersState,
): Promise<IncentivesAccessState> {
  const auth = await getDashboardAuthContext();
  if (!auth.ok) {
    return {
      view: auth.reason === "unauthenticated" ? "unauthenticated" : "forbidden",
      message: auth.reason === "unauthenticated" ? "Not logged in" : auth.message,
    };
  }

  const isAdmin = auth.roleName === "Admin";
  const isBranchManager = auth.roleName === "Branch Manager";
  const isAuditor = auth.roleName === "Auditor";

  if (!isAdmin && !isBranchManager && !isAuditor) {
    return {
      view: "forbidden",
      message:
        "You are logged in, but only Admin, Branch Manager, and Auditor users can access payout computation and history.",
    };
  }

  if (isBranchManager) {
    const branchResolution = await resolveActiveBranchForBranchManager(auth.userId);
    if (!branchResolution.ok) {
      return {
        view: "branch_error",
        message: branchResolution.message,
      };
    }

    return {
      view: "ready",
      roleName: "Branch Manager",
      isAdmin: false,
      isBranchManager: true,
      isAuditor: false,
      selectedMonthRaw: filters.selectedMonthRaw,
      selectedBranchRaw: filters.selectedBranchRaw,
      payPeriod: filters.payPeriod,
      branches: [],
      filterBranches: [],
      auditorBranchIds: [],
      fixedBranchName: branchResolution.branchName,
      resolvedBranchId: branchResolution.branchId,
      resolvedBranchName: branchResolution.branchName,
      allAssignedBranchesMode: false,
    };
  }

  const branches = await db
    .select({
      branch_id: branch.branch_id,
      branch_name: branch.branch_name,
    })
    .from(branch)
    .orderBy(asc(branch.branch_name))
    .catch(() => []);

  const filterBranches = isAuditor
    ? branches.filter((item) => auth.assignedBranchIds.includes(item.branch_id))
    : branches;
  const selectedBranchId = /^\d+$/.test(filters.selectedBranchRaw) ? Number(filters.selectedBranchRaw) : null;
  const resolvedBranchId = isAuditor
    ? selectedBranchId && auth.assignedBranchIds.includes(selectedBranchId)
      ? selectedBranchId
      : null
    : selectedBranchId;
  const resolvedBranchName = filterBranches.find((item) => item.branch_id === resolvedBranchId)?.branch_name ?? null;

  return {
    view: "ready",
    roleName: isAuditor ? "Auditor" : "Admin",
    isAdmin,
    isBranchManager: false,
    isAuditor,
    selectedMonthRaw: filters.selectedMonthRaw,
    selectedBranchRaw: filters.selectedBranchRaw,
    payPeriod: filters.payPeriod,
    branches,
    filterBranches,
    auditorBranchIds: isAuditor ? auth.assignedBranchIds : [],
    fixedBranchName: null,
    resolvedBranchId,
    resolvedBranchName,
    allAssignedBranchesMode: isAuditor && filters.selectedBranchRaw === "all" && auth.assignedBranchIds.length > 0,
  };
}
