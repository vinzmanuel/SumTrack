import { eq } from "drizzle-orm";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import type {
  CollectionActionResolution,
  CollectionCreatorAccess,
  CollectionStateFactory,
  LoanCollectionContext,
} from "@/app/dashboard/loans/[loanId]/collection-action-types";
import { buildCollectionErrorState } from "@/app/dashboard/loans/[loanId]/collection-action-validation";
import { db } from "@/db";
import { employee_info, loan_records, roles, users } from "@/db/schema";

function toLoanId(value: string) {
  return /^\d+$/.test(value) ? Number(value) : null;
}

export async function resolveCollectionCreatorAccess(
  factory: CollectionStateFactory,
): Promise<CollectionActionResolution<CollectionCreatorAccess>> {
  const auth = await getDashboardAuthContext();
  if (!auth.ok) {
    return {
      ok: false,
      state: buildCollectionErrorState(
        factory,
        auth.reason === "unauthenticated" ? "You must be logged in." : "Unable to verify your app account.",
      ),
    };
  }

  const isAdmin = auth.roleName === "Admin";
  const isBranchManager = auth.roleName === "Branch Manager";
  const isSecretary = auth.roleName === "Secretary";

  if (!isAdmin && !isBranchManager && !isSecretary) {
    return {
      ok: false,
      state: buildCollectionErrorState(
        factory,
        "Only Admin, Branch Manager, and Secretary users can record collections.",
      ),
    };
  }

  if (!isAdmin && !auth.activeBranchId) {
    return {
      ok: false,
      state: buildCollectionErrorState(
        factory,
        "A single active branch assignment is required before recording collections.",
      ),
    };
  }

  return {
    ok: true,
    data: {
      userId: auth.userId,
      isAdmin,
      allowedBranchId: isAdmin ? null : auth.activeBranchId,
    },
  };
}

export async function resolveLoanCollectionContext(
  factory: CollectionStateFactory,
  creator: CollectionCreatorAccess,
  loanIdRaw: string,
): Promise<CollectionActionResolution<LoanCollectionContext>> {
  const loanId = toLoanId(loanIdRaw);
  if (loanId === null) {
    return {
      ok: false,
      state: buildCollectionErrorState(factory, "Loan not found."),
    };
  }

  const loan = await db
    .select({
      loan_id: loan_records.loan_id,
      loan_code: loan_records.loan_code,
      branch_id: loan_records.branch_id,
      collector_id: loan_records.collector_id,
      collector_user_id: users.user_id,
      collector_username: users.username,
      collector_role_name: roles.role_name,
      collector_first_name: employee_info.first_name,
      collector_last_name: employee_info.last_name,
    })
    .from(loan_records)
    .leftJoin(users, eq(users.user_id, loan_records.collector_id))
    .leftJoin(roles, eq(roles.role_id, users.role_id))
    .leftJoin(employee_info, eq(employee_info.user_id, users.user_id))
    .where(eq(loan_records.loan_id, loanId))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!loan) {
    return {
      ok: false,
      state: buildCollectionErrorState(factory, "Loan not found."),
    };
  }

  if (!creator.isAdmin && creator.allowedBranchId !== null && loan.branch_id !== creator.allowedBranchId) {
    return {
      ok: false,
      state: buildCollectionErrorState(
        factory,
        "You can only record collections for loans in your assigned branch.",
      ),
    };
  }

  if (!loan.collector_id) {
    return {
      ok: false,
      state: buildCollectionErrorState(factory, "No collector is assigned to this loan."),
    };
  }

  if (!loan.collector_user_id) {
    return {
      ok: false,
      state: buildCollectionErrorState(factory, "Assigned collector account not found."),
    };
  }

  if (loan.collector_role_name !== "Collector") {
    return {
      ok: false,
      state: buildCollectionErrorState(factory, "Assigned account is not a Collector."),
    };
  }

  const collectorName =
    [loan.collector_first_name, loan.collector_last_name].filter(Boolean).join(" ") ||
    loan.collector_username ||
    loan.collector_user_id;

  return {
    ok: true,
    data: {
      loanId: loan.loan_id,
      loanCode: loan.loan_code,
      branchId: loan.branch_id,
      collectorName,
    },
  };
}
