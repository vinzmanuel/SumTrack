import {
  computeLiveIncentivesForPeriod,
  getFinalizedBatchForPeriod,
  isFinalizationWindowOpen,
  loadHistoricalIncentives,
  mapBatchMeta,
} from "@/app/dashboard/incentives/lib";
import { sectionTotal, toExportRows } from "@/app/dashboard/incentives/format";
import type { IncentivesAccessState, IncentivesBranchOption, IncentivesViewState, LoadedBranchIncentives } from "@/app/dashboard/incentives/types";

async function loadSingleBranchIncentives(
  branchId: number,
  branchName: string,
  periodStart: string,
  periodEnd: string,
): Promise<LoadedBranchIncentives> {
  const batchMeta = mapBatchMeta(await getFinalizedBatchForPeriod(branchId, periodStart, periodEnd));

  if (batchMeta) {
    const historicalData = await loadHistoricalIncentives(batchMeta);
    const branchCollectorAverage = historicalData.collectorRows.length > 0
      ? historicalData.collectorRows.reduce((sum, row) => sum + row.baseAmount, 0) / historicalData.collectorRows.length
      : 0;

    return {
      collectorRows: historicalData.collectorRows,
      secretaryRows: historicalData.secretaryRows,
      branchManagerRows: historicalData.branchManagerRows,
      branchCollectorAverage,
      collectorRuleMissing: false,
      secretaryRuleMissing: false,
      branchManagerRuleMissing: false,
      batchMeta,
    };
  }

  const liveData = await computeLiveIncentivesForPeriod(branchId, branchName, periodStart, periodEnd);
  return {
    ...liveData,
    batchMeta: null,
  };
}

async function loadAuditorAllBranchesIncentives(
  branches: IncentivesBranchOption[],
  periodStart: string,
  periodEnd: string,
): Promise<LoadedBranchIncentives> {
  const branchResults = await Promise.all(
    branches.map((branchOption) =>
      loadSingleBranchIncentives(branchOption.branch_id, branchOption.branch_name, periodStart, periodEnd),
    ),
  );

  const collectorRows = branchResults.flatMap((result) => result.collectorRows);
  const secretaryRows = branchResults.flatMap((result) => result.secretaryRows);
  const branchManagerRows = branchResults.flatMap((result) => result.branchManagerRows);
  const branchCollectorAverage = collectorRows.length > 0
    ? collectorRows.reduce((sum, row) => sum + row.baseAmount, 0) / collectorRows.length
    : 0;

  return {
    collectorRows,
    secretaryRows,
    branchManagerRows,
    branchCollectorAverage,
    collectorRuleMissing: false,
    secretaryRuleMissing: false,
    branchManagerRuleMissing: false,
    batchMeta: null,
  };
}

export async function loadIncentivesViewState(
  access: Extract<IncentivesAccessState, { view: "ready" }>,
): Promise<IncentivesViewState> {
  if (!access.payPeriod) {
    return { kind: "invalid_period" };
  }

  const activeBranchSelection =
    access.resolvedBranchId !== null && access.resolvedBranchName
      ? { branchId: access.resolvedBranchId, branchName: access.resolvedBranchName }
      : null;

  if (!activeBranchSelection && !access.allAssignedBranchesMode) {
    return { kind: "branch_required" };
  }

  const loadedData = activeBranchSelection
    ? await loadSingleBranchIncentives(
        activeBranchSelection.branchId,
        activeBranchSelection.branchName,
        access.payPeriod.periodStart,
        access.payPeriod.periodEnd,
      )
    : await loadAuditorAllBranchesIncentives(
        access.filterBranches,
        access.payPeriod.periodStart,
        access.payPeriod.periodEnd,
      );

  const allRows = [...loadedData.collectorRows, ...loadedData.secretaryRows, ...loadedData.branchManagerRows];
  const totalEmployees = allRows.length;
  const totalComputedIncentive = sectionTotal(allRows);
  const exportRows = toExportRows(allRows);
  const batchMeta = loadedData.batchMeta;
  const isFinalized = Boolean(batchMeta);
  const finalizationWindowOpen = isFinalizationWindowOpen(access.payPeriod.periodEnd);
  const canFinalize = Boolean(
    !access.isAuditor && !isFinalized && activeBranchSelection && finalizationWindowOpen,
  );

  let finalizeLockReason = "";
  if (isFinalized) {
    finalizeLockReason = "This month has already been finalized.";
  } else if (!activeBranchSelection) {
    finalizeLockReason = "Select a branch first.";
  } else if (!finalizationWindowOpen) {
    finalizeLockReason = `Finalization is allowed starting ${access.payPeriod.periodEnd} at 5:00 PM (Asia/Manila).`;
  }

  const finalizedByText = batchMeta
    ? [
        batchMeta.finalizedByName,
        batchMeta.finalizedByCompanyId ?? batchMeta.finalizedByUsername ?? batchMeta.finalizedByUserId,
      ]
        .filter(Boolean)
        .join(" - ")
    : null;

  const safeBranch = (access.resolvedBranchName ?? "branch").replace(/[^a-zA-Z0-9_-]/g, "_");
  const exportFileName = `incentives_${safeBranch}_${access.selectedMonthRaw}.csv`;
  const modeLabel = isFinalized
    ? "Historical View"
    : access.allAssignedBranchesMode
      ? "All Assigned Branches"
      : "Live Computation";

  return {
    kind: "ready",
    collectorRows: loadedData.collectorRows,
    secretaryRows: loadedData.secretaryRows,
    branchManagerRows: loadedData.branchManagerRows,
    branchCollectorAverage: loadedData.branchCollectorAverage,
    collectorRuleMissing: loadedData.collectorRuleMissing,
    secretaryRuleMissing: loadedData.secretaryRuleMissing,
    branchManagerRuleMissing: loadedData.branchManagerRuleMissing,
    batchMeta,
    totalEmployees,
    totalComputedIncentive,
    exportRows,
    periodLabel: batchMeta?.periodLabel ?? access.payPeriod.label,
    periodStart: batchMeta?.periodStart ?? access.payPeriod.periodStart,
    periodEnd: batchMeta?.periodEnd ?? access.payPeriod.periodEnd,
    isFinalized,
    canFinalize,
    finalizeLockReason,
    finalizedByText,
    exportFileName,
    modeLabel,
  };
}
