import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import {
  parseManageUserAccountsFilters,
  resolveManageUserAccountsAccess,
} from "@/app/dashboard/manage-user-accounts/filters";
import {
  loadCollectorLoanReassignmentPreview,
  reassignCollectorLiveLoans,
} from "@/app/dashboard/manage-user-accounts/queries";
import { type ManagedCollectorBlockedActionType } from "@/app/dashboard/manage-user-accounts/types";

function parseActionType(value: string | null): ManagedCollectorBlockedActionType | null {
  if (
    value === "role_change" ||
    value === "branch_reassignment" ||
    value === "area_reassignment" ||
    value === "deactivate" ||
    value === "delete"
  ) {
    return value;
  }

  return null;
}

function parseOptionalNumber(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  return /^\d+$/.test(String(value ?? "")) ? Number(value) : null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const auth = await getDashboardAuthContext();
  const accessState = resolveManageUserAccountsAccess(auth, parseManageUserAccountsFilters({}));

  if (accessState.view !== "staff") {
    return NextResponse.json({ message: "You are not authorized to reassign collector loans." }, { status: 403 });
  }

  const { userId } = await context.params;
  const url = new URL(request.url);
  const actionType = parseActionType(url.searchParams.get("actionType"));

  if (!actionType) {
    return NextResponse.json({ message: "Invalid reassignment action type." }, { status: 400 });
  }

  const preview = await loadCollectorLoanReassignmentPreview({
    scope: accessState,
    collectorId: userId,
    actionType,
    nextRole: url.searchParams.get("nextRole"),
    nextBranchId: parseOptionalNumber(url.searchParams.get("nextBranchId")),
    nextAreaId: parseOptionalNumber(url.searchParams.get("nextAreaId")),
  });

  if ("ok" in preview && !preview.ok) {
    return NextResponse.json(preview, { status: 400 });
  }

  return NextResponse.json(preview, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const auth = await getDashboardAuthContext();
  const accessState = resolveManageUserAccountsAccess(auth, parseManageUserAccountsFilters({}));

  if (accessState.view !== "staff") {
    return NextResponse.json({ message: "You are not authorized to reassign collector loans." }, { status: 403 });
  }

  const { userId } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | {
        actionType?: string;
        replacementCollectorId?: string;
        nextRole?: string | null;
        nextBranchId?: string | number | null;
        nextAreaId?: string | number | null;
      }
    | null;

  const actionType = parseActionType(body?.actionType ?? null);
  const replacementCollectorId = String(body?.replacementCollectorId ?? "").trim();

  if (!actionType) {
    return NextResponse.json({ message: "Invalid reassignment action type." }, { status: 400 });
  }

  if (!replacementCollectorId) {
    return NextResponse.json({ message: "Replacement collector is required." }, { status: 400 });
  }

  const result = await reassignCollectorLiveLoans({
    scope: accessState,
    collectorId: userId,
    replacementCollectorId,
    actionType,
    nextRole: body?.nextRole ?? null,
    nextBranchId: parseOptionalNumber(body?.nextBranchId),
    nextAreaId: parseOptionalNumber(body?.nextAreaId),
  });

  if ("ok" in result && !result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
