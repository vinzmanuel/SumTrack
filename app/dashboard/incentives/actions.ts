"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import {
  computeLiveIncentivesForPeriod,
  getFinalizedBatchForPeriod,
  isFinalizationWindowOpen,
  resolveActiveBranchForBranchManager,
  resolvePayPeriod,
} from "@/app/dashboard/incentives/lib";
import type { FinalizeIncentiveState } from "@/app/dashboard/incentives/state";
import { db } from "@/db";
import { branch, incentive_payout_batches, incentive_payout_history } from "@/db/schema";

function readTrimmed(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function parseBranchId(value: string) {
  return /^\d+$/.test(value) ? Number(value) : null;
}

export async function finalizeIncentivePayoutAction(
  _prevState: FinalizeIncentiveState,
  formData: FormData,
): Promise<FinalizeIncentiveState> {
  const selectedMonth = readTrimmed(formData, "month");
  const requestedBranchRaw = readTrimmed(formData, "branch_id");

  const payPeriod = resolvePayPeriod(selectedMonth);
  if (!payPeriod) {
    return {
      status: "error",
      message: "Invalid month filter.",
    };
  }

  const auth = await getDashboardAuthContext();
  if (!auth.ok) {
    return {
      status: "error",
      message: auth.reason === "unauthenticated" ? "Not logged in." : auth.message,
    };
  }

  const isAdmin = auth.roleName === "Admin";
  const isBranchManager = auth.roleName === "Branch Manager";

  if (!isAdmin && !isBranchManager) {
    return {
      status: "error",
      message: "Only Admin and Branch Manager users can finalize payouts.",
    };
  }

  let branchId: number | null = null;
  let branchName: string | null = null;

  if (isBranchManager) {
    const branchResolution = await resolveActiveBranchForBranchManager(auth.userId);
    if (!branchResolution.ok) {
      return {
        status: "error",
        message: `${branchResolution.message} Finalization is blocked.`,
      };
    }

    branchId = branchResolution.branchId;
    branchName = branchResolution.branchName;
  } else {
    const parsedBranchId = parseBranchId(requestedBranchRaw);
    if (parsedBranchId === null) {
      return {
        status: "error",
        message: "Select a branch before finalizing.",
      };
    }

    const selectedBranch = await db
      .select({
        branch_id: branch.branch_id,
        branch_name: branch.branch_name,
      })
      .from(branch)
      .where(eq(branch.branch_id, parsedBranchId))
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null);

    if (!selectedBranch) {
      return {
        status: "error",
        message: "Selected branch does not exist.",
      };
    }

    branchId = selectedBranch.branch_id;
    branchName = selectedBranch.branch_name;
  }

  if (branchId === null || !branchName) {
    return {
      status: "error",
      message: "Unable to resolve branch for finalization.",
    };
  }

  if (!isFinalizationWindowOpen(payPeriod.periodEnd)) {
    const cutoffDate = `${payPeriod.periodEnd} 5:00 PM`;
    return {
      status: "error",
      message: `Finalization is only allowed starting ${cutoffDate} (Asia/Manila).`,
    };
  }

  const existingBatch = await getFinalizedBatchForPeriod(
    branchId,
    payPeriod.periodStart,
    payPeriod.periodEnd,
  );
  if (existingBatch) {
    return {
      status: "error",
      message: "This branch and month has already been finalized.",
    };
  }

  const liveData = await computeLiveIncentivesForPeriod(
    branchId,
    branchName,
    payPeriod.periodStart,
    payPeriod.periodEnd,
  );

  const allRows = [...liveData.collectorRows, ...liveData.secretaryRows, ...liveData.branchManagerRows];
  const hasMissingRule = allRows.some((row) => row.missingRule);
  if (hasMissingRule) {
    const affectedRoles = Array.from(
      new Set(allRows.filter((row) => row.missingRule).map((row) => row.roleName)),
    );
    return {
      status: "error",
      message: `Cannot finalize because incentive rules are missing for: ${affectedRoles.join(", ")}.`,
    };
  }

  try {
    await db.transaction(async (tx) => {
      const insertedBatch = await tx
        .insert(incentive_payout_batches)
        .values({
          branch_id: branchId,
          period_label: payPeriod.label,
          period_start: payPeriod.periodStart,
          period_end: payPeriod.periodEnd,
          finalized_by: auth.userId,
        })
        .returning({ batch_id: incentive_payout_batches.batch_id })
        .then((rows) => rows[0] ?? null);

      if (!insertedBatch) {
        throw new Error("Failed to create payout batch.");
      }

      if (allRows.length === 0) {
        return;
      }

      await tx.insert(incentive_payout_history).values(
        allRows.map((row) => ({
          batch_id: insertedBatch.batch_id,
          employee_user_id: row.userId,
          role_id: row.roleId,
          base_amount: row.baseAmount.toFixed(2),
          percent_value: (row.percentValue ?? 0).toFixed(2),
          flat_amount: (row.flatAmount ?? 0).toFixed(2),
          computed_incentive: (row.computedIncentive ?? 0).toFixed(2),
        })),
      );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    if (
      message.includes("uq_incentive_payout_batches_branch_period") ||
      message.toLowerCase().includes("duplicate")
    ) {
      return {
        status: "error",
        message: "This branch and month has already been finalized.",
      };
    }

    return {
      status: "error",
      message: `Finalization failed: ${message}`,
    };
  }

  revalidatePath("/dashboard/incentives");
  return {
    status: "success",
    message: "Payout finalized and saved to payout history.",
  };
}
