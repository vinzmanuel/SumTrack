import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { audit_logs, borrower_info, employee_info, roles, users } from "@/db/schema";
import type { DashboardAuthContext } from "@/app/dashboard/auth";
import type { AuditAction, AuditEntityType } from "@/lib/audit/taxonomy";
import type { AuditRequestContext } from "@/lib/audit/request-context";

export type AuditActor =
  | {
      type: "user";
      userId?: string | null;
      companyId?: string | null;
      displayName?: string | null;
      roleName?: string | null;
    }
  | {
      type: "system";
      userId?: string | null;
      companyId?: string | null;
      displayName?: string | null;
      roleName?: string | null;
    };

export type AuditTarget = {
  userId?: string | null;
  companyId?: string | null;
  displayName?: string | null;
};

export type AuditMetadata = Record<string, unknown>;

export type AuditLogEventInput = {
  occurredAt?: string | null;
  actor?: AuditActor | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | number | null;
  branchId?: number | null;
  branchScope?: number[] | null;
  target?: AuditTarget | null;
  description: string;
  metadata?: AuditMetadata | null;
  requestContext?: AuditRequestContext | null;
};

function sanitizeJsonValue(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonValue(item));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, sanitizeJsonValue(entryValue)]),
    );
  }

  return value;
}

function sanitizeMetadata(metadata: AuditMetadata | null | undefined) {
  const sanitized = sanitizeJsonValue(metadata ?? {}) as Record<string, unknown>;
  return sanitized ?? {};
}

function normalizeBranchScope(branchScope: number[] | null | undefined, branchId: number | null | undefined) {
  const values = [...(branchScope ?? []), ...(typeof branchId === "number" ? [branchId] : [])].filter((value) =>
    Number.isInteger(value),
  );

  return Array.from(new Set(values)).sort((left, right) => left - right);
}

function formatResolvedActorDisplayName(params: {
  employeeFirstName: string | null;
  employeeMiddleName: string | null;
  employeeLastName: string | null;
  borrowerFirstName: string | null;
  borrowerMiddleName: string | null;
  borrowerLastName: string | null;
  companyId: string | null;
  username: string | null;
  userId: string;
}) {
  const employeeMiddleInitial = params.employeeMiddleName?.trim()
    ? `${params.employeeMiddleName.trim().charAt(0)}.`
    : null;
  const employeeName = [
    params.employeeFirstName,
    employeeMiddleInitial,
    params.employeeLastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (employeeName) {
    return employeeName;
  }

  const borrowerMiddleInitial = params.borrowerMiddleName?.trim()
    ? `${params.borrowerMiddleName.trim().charAt(0)}.`
    : null;
  const borrowerName = [
    params.borrowerFirstName,
    borrowerMiddleInitial,
    params.borrowerLastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (borrowerName) {
    return borrowerName;
  }

  return params.companyId || params.username || params.userId;
}

async function enrichAuditActor(actor: AuditActor): Promise<AuditActor> {
  if (actor.type !== "user" || !actor.userId) {
    return actor;
  }

  if (actor.companyId && actor.displayName && actor.roleName) {
    return actor;
  }

  const resolved = await db
    .select({
      userId: users.user_id,
      companyId: users.company_id,
      username: users.username,
      roleName: roles.role_name,
      employeeFirstName: employee_info.first_name,
      employeeMiddleName: employee_info.middle_name,
      employeeLastName: employee_info.last_name,
      borrowerFirstName: borrower_info.first_name,
      borrowerMiddleName: borrower_info.middle_name,
      borrowerLastName: borrower_info.last_name,
    })
    .from(users)
    .leftJoin(roles, eq(roles.role_id, users.role_id))
    .leftJoin(employee_info, eq(employee_info.user_id, users.user_id))
    .leftJoin(borrower_info, eq(borrower_info.user_id, users.user_id))
    .where(eq(users.user_id, actor.userId))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!resolved) {
    return actor;
  }

  return {
    ...actor,
    companyId: actor.companyId ?? resolved.companyId ?? resolved.username ?? null,
    displayName:
      actor.displayName ??
      formatResolvedActorDisplayName({
        employeeFirstName: resolved.employeeFirstName,
        employeeMiddleName: resolved.employeeMiddleName,
        employeeLastName: resolved.employeeLastName,
        borrowerFirstName: resolved.borrowerFirstName,
        borrowerMiddleName: resolved.borrowerMiddleName,
        borrowerLastName: resolved.borrowerLastName,
        companyId: resolved.companyId,
        username: resolved.username,
        userId: resolved.userId,
      }),
    roleName: actor.roleName ?? resolved.roleName ?? null,
  };
}

export function buildAuditActorFromAuth(auth: Pick<DashboardAuthContext, "userId" | "roleName"> & {
  companyId?: string | null;
  displayName?: string | null;
}): AuditActor {
  return {
    type: "user",
    userId: auth.userId,
    companyId: auth.companyId,
    displayName: auth.displayName,
    roleName: auth.roleName,
  };
}

export function buildSystemAuditActor(overrides?: {
  userId?: string | null;
  companyId?: string | null;
  displayName?: string | null;
  roleName?: string | null;
}): AuditActor {
  return {
    type: "system",
    userId: overrides?.userId ?? null,
    companyId: overrides?.companyId ?? null,
    displayName: overrides?.displayName ?? "System",
    roleName: overrides?.roleName ?? "System",
  };
}

export async function logAuditEvent(input: AuditLogEventInput, options?: { strict?: boolean }) {
  const actor = await enrichAuditActor(input.actor ?? buildSystemAuditActor());
  const branchScope = normalizeBranchScope(input.branchScope, input.branchId);

  try {
    await db.insert(audit_logs).values({
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      actor_type: actor.type,
      actor_user_id: actor.userId ?? null,
      actor_company_id: actor.companyId ?? null,
      actor_display_name: actor.displayName ?? null,
      actor_role_name: actor.roleName ?? null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId !== undefined && input.entityId !== null ? String(input.entityId) : null,
      branch_id: input.branchId ?? null,
      branch_scope: branchScope,
      target_user_id: input.target?.userId ?? null,
      target_company_id: input.target?.companyId ?? null,
      target_display_name: input.target?.displayName ?? null,
      description: input.description,
      metadata: sanitizeMetadata(input.metadata),
      ip_address: input.requestContext?.ipAddress ?? null,
      user_agent: input.requestContext?.userAgent ?? null,
    });
  } catch (error) {
    if (options?.strict) {
      throw error;
    }

    console.error("[audit] failed to write audit event", {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      error,
    });
  }
}

export async function logAuditEvents(inputs: AuditLogEventInput[], options?: { strict?: boolean }) {
  for (const input of inputs) {
    await logAuditEvent(input, options);
  }
}
