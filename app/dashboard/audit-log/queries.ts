import "server-only";

import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { db } from "@/db";
import { audit_logs, borrower_info, branch, employee_info, roles, users } from "@/db/schema";
import type {
  AuditLogFilterAction,
  AuditLogActorOption,
  AuditLogActorRoleOption,
  AuditLogDatePreset,
  AuditLogFilterEntity,
  AuditLogFilters,
  AuditLogPageAccess,
  AuditLogPageData,
} from "@/app/dashboard/audit-log/types";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, type AuditAction } from "@/lib/audit/taxonomy";

const DEFAULT_PAGE_SIZE = 25;
const actorUsers = alias(users, "audit_log_actor_users");
const actorRoles = alias(roles, "audit_log_actor_roles");
const actorEmployeeInfo = alias(employee_info, "audit_log_actor_employee_info");
const actorBorrowerInfo = alias(borrower_info, "audit_log_actor_borrower_info");

const actorResolvedDisplayNameSql = sql<string>`coalesce(
  ${audit_logs.actor_display_name},
  nullif(trim(concat_ws(' ', ${actorEmployeeInfo.first_name}, ${actorEmployeeInfo.middle_name}, ${actorEmployeeInfo.last_name})), ''),
  nullif(trim(concat_ws(' ', ${actorBorrowerInfo.first_name}, ${actorBorrowerInfo.middle_name}, ${actorBorrowerInfo.last_name})), ''),
  ${actorUsers.company_id},
  ${actorUsers.username}
)`;

const actorResolvedCompanyIdSql = sql<string>`coalesce(
  ${audit_logs.actor_company_id},
  ${actorUsers.company_id},
  ${actorUsers.username}
)`;

const actorResolvedRoleNameSql = sql<string>`coalesce(
  ${audit_logs.actor_role_name},
  ${actorRoles.role_name}
)`;

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value || !/^\d+$/.test(value)) {
    return fallback;
  }

  return Math.max(Number(value), 1);
}

function isAuditLogFilterAction(value: string | undefined): value is AuditLogFilterAction {
  return (
    Boolean(value && AUDIT_ACTIONS.includes(value as AuditAction)) ||
    value === "collection.payment_recorded" ||
    value === "collection.missed_payment_recorded"
  );
}

function isAuditLogFilterEntity(value: string | undefined): value is AuditLogFilterEntity {
  return Boolean(value && AUDIT_ENTITY_TYPES.includes(value as AuditLogFilterEntity));
}

export function resolveAuditLogAccess(auth: Awaited<ReturnType<typeof getDashboardAuthContext>>): AuditLogPageAccess {
  if (!auth.ok) {
    return {
      view: "unauthenticated",
      message: auth.reason === "unauthenticated" ? "You must be logged in." : auth.message,
    };
  }

  if (auth.roleName !== "Admin" && auth.roleName !== "Auditor") {
    return {
      view: "forbidden",
      message: "Audit Log is only available to Admin and Auditor users.",
    };
  }

  if (auth.roleName === "Auditor" && auth.assignedBranchIds.length === 0) {
    return {
      view: "scope_error",
      message: "No assigned audit branches were found for your account.",
    };
  }

  return {
    view: "ready",
    roleName: auth.roleName,
    userId: auth.userId,
    allowedBranchIds: auth.assignedBranchIds,
    canChooseBranch: auth.roleName === "Admin",
  };
}

export function parseAuditLogFilters(
  searchParams: Record<string, string | string[] | undefined>,
): AuditLogFilters {
  const presetRaw = firstSearchValue(searchParams.preset);
  const preset: AuditLogDatePreset =
    presetRaw === "today" || presetRaw === "7d" || presetRaw === "90d" || presetRaw === "custom"
      ? presetRaw
      : "30d";

  const actionRaw = firstSearchValue(searchParams.action);
  const entityTypeRaw = firstSearchValue(searchParams.entity);
  const branchRaw = firstSearchValue(searchParams.branch);
  const actorRaw = firstSearchValue(searchParams.actor);

  return {
    preset,
    fromDate: preset === "custom" ? firstSearchValue(searchParams.from) ?? null : null,
    toDate: preset === "custom" ? firstSearchValue(searchParams.to) ?? null : null,
    branchId: branchRaw && /^\d+$/.test(branchRaw) ? Number(branchRaw) : null,
    action: isAuditLogFilterAction(actionRaw) ? actionRaw : "all",
    entityType: isAuditLogFilterEntity(entityTypeRaw) ? entityTypeRaw : "all",
    actorRole: (firstSearchValue(searchParams.actorRole) ?? "").trim() || "all",
    actor: actorRaw?.trim() ? actorRaw.trim() : "all",
    query: (firstSearchValue(searchParams.query) ?? "").trim(),
    page: parsePositiveInt(firstSearchValue(searchParams.page), 1),
    pageSize: parsePositiveInt(firstSearchValue(searchParams.pageSize), DEFAULT_PAGE_SIZE),
  };
}

function resolveDateWindow(filters: AuditLogFilters) {
  const today = new Date();
  const end = today.toISOString().slice(0, 10);

  if (filters.preset === "custom") {
    return {
      from: filters.fromDate,
      to: filters.toDate,
    };
  }

  const days =
    filters.preset === "today"
      ? 0
      : filters.preset === "7d"
        ? 6
        : filters.preset === "90d"
          ? 89
          : 29;
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - days);
  return {
    from: start.toISOString().slice(0, 10),
    to: end,
  };
}

function buildIntegerArraySql(values: number[]) {
  if (values.length === 0) {
    return sql`'{}'::integer[]`;
  }

  return sql`array[${sql.join(
    values.map((value) => sql`${value}`),
    sql.raw(", "),
  )}]::integer[]`;
}

function buildAuditLogWhere(
  access: Extract<AuditLogPageAccess, { view: "ready" }>,
  filters: AuditLogFilters,
  options?: {
    omitActor?: boolean;
    omitActorRole?: boolean;
  },
) {
  const conditions: Array<SQL | undefined> = [];

  if (access.roleName === "Auditor") {
    conditions.push(sql`${audit_logs.branch_scope} && ${buildIntegerArraySql(access.allowedBranchIds)}`);
  }

  if (filters.branchId) {
    conditions.push(eq(audit_logs.branch_id, filters.branchId));
  }

  if (filters.action !== "all") {
    if (filters.action === "collection.payment_recorded") {
      conditions.push(eq(audit_logs.action, "collection.recorded"));
      conditions.push(sql`coalesce(${audit_logs.metadata}->>'missedPayment', 'false') <> 'true'`);
    } else if (filters.action === "collection.missed_payment_recorded") {
      conditions.push(eq(audit_logs.action, "collection.recorded"));
      conditions.push(sql`coalesce(${audit_logs.metadata}->>'missedPayment', 'false') = 'true'`);
    } else {
      conditions.push(eq(audit_logs.action, filters.action));
    }
  }

  if (filters.entityType !== "all") {
    conditions.push(eq(audit_logs.entity_type, filters.entityType));
  }

  if (!options?.omitActorRole && filters.actorRole !== "all") {
    conditions.push(
      sql`coalesce(
        ${audit_logs.actor_role_name},
        (
          select ${roles.role_name}
          from ${users}
          inner join ${roles} on ${roles.role_id} = ${users.role_id}
          where ${users.user_id} = ${audit_logs.actor_user_id}
          limit 1
        )
      ) = ${filters.actorRole}`,
    );
  }

  if (!options?.omitActor && filters.actor !== "all") {
    conditions.push(
      filters.actor === "__system__"
        ? eq(audit_logs.actor_type, "system")
        : eq(audit_logs.actor_user_id, filters.actor),
    );
  }

  const window = resolveDateWindow(filters);
  if (window.from) {
    conditions.push(sql`date(${audit_logs.occurred_at}) >= ${window.from}`);
  }
  if (window.to) {
    conditions.push(sql`date(${audit_logs.occurred_at}) <= ${window.to}`);
  }

  if (filters.query) {
    const pattern = `%${filters.query}%`;
    conditions.push(
      sql`(
        ${audit_logs.description} ilike ${pattern}
        or coalesce(${audit_logs.actor_display_name}, '') ilike ${pattern}
        or coalesce(${audit_logs.actor_company_id}, '') ilike ${pattern}
        or coalesce(${audit_logs.target_display_name}, '') ilike ${pattern}
        or coalesce(${audit_logs.target_company_id}, '') ilike ${pattern}
        or coalesce(${audit_logs.entity_id}, '') ilike ${pattern}
        or cast(${audit_logs.metadata} as text) ilike ${pattern}
      )`,
    );
  }

  const resolved = conditions.filter((value): value is SQL => Boolean(value));
  if (resolved.length === 0) {
    return undefined;
  }

  return resolved.length === 1 ? resolved[0] : and(...resolved);
}

async function loadActorOptions(
  where: SQL | undefined,
): Promise<AuditLogActorOption[]> {
  const rows = await db
    .select({
      actorUserId: audit_logs.actor_user_id,
      actorType: audit_logs.actor_type,
      actorDisplayName: actorResolvedDisplayNameSql,
      actorCompanyId: actorResolvedCompanyIdSql,
      actorRoleName: actorResolvedRoleNameSql,
    })
    .from(audit_logs)
    .leftJoin(actorUsers, eq(actorUsers.user_id, audit_logs.actor_user_id))
    .leftJoin(actorRoles, eq(actorRoles.role_id, actorUsers.role_id))
    .leftJoin(actorEmployeeInfo, eq(actorEmployeeInfo.user_id, actorUsers.user_id))
    .leftJoin(actorBorrowerInfo, eq(actorBorrowerInfo.user_id, actorUsers.user_id))
    .where(where)
    .groupBy(
      audit_logs.actor_user_id,
      audit_logs.actor_type,
      audit_logs.actor_display_name,
      audit_logs.actor_company_id,
      audit_logs.actor_role_name,
      actorUsers.company_id,
      actorUsers.username,
      actorRoles.role_name,
      actorEmployeeInfo.first_name,
      actorEmployeeInfo.middle_name,
      actorEmployeeInfo.last_name,
      actorBorrowerInfo.first_name,
      actorBorrowerInfo.middle_name,
      actorBorrowerInfo.last_name,
    )
    .orderBy(asc(actorResolvedDisplayNameSql), asc(actorResolvedCompanyIdSql))
    .catch(() => []);

  const options = rows.map((row) => {
    if (row.actorType === "system") {
      return {
        actorKey: "__system__",
        label: "System",
      };
    }

    const identity = [row.actorDisplayName, row.actorCompanyId].filter(Boolean).join(" ");
    const roleSuffix = row.actorRoleName ? ` • ${row.actorRoleName}` : "";
    return {
      actorKey: row.actorUserId ?? "",
      label: `${identity || "Unknown user"}${roleSuffix}`,
    };
  });

  const deduped = new Map<string, AuditLogActorOption>();
  for (const option of options) {
    if (option.actorKey) {
      deduped.set(option.actorKey, option);
    }
  }

  return Array.from(deduped.values());
}

async function loadActorRoleOptions(where: SQL | undefined): Promise<AuditLogActorRoleOption[]> {
  const rows = await db
    .select({
      actorRoleName: actorResolvedRoleNameSql,
      actorType: audit_logs.actor_type,
    })
    .from(audit_logs)
    .leftJoin(actorUsers, eq(actorUsers.user_id, audit_logs.actor_user_id))
    .leftJoin(actorRoles, eq(actorRoles.role_id, actorUsers.role_id))
    .leftJoin(actorEmployeeInfo, eq(actorEmployeeInfo.user_id, actorUsers.user_id))
    .leftJoin(actorBorrowerInfo, eq(actorBorrowerInfo.user_id, actorUsers.user_id))
    .where(where)
    .groupBy(
      audit_logs.actor_type,
      audit_logs.actor_role_name,
      actorRoles.role_name,
      actorUsers.company_id,
      actorUsers.username,
      actorEmployeeInfo.first_name,
      actorEmployeeInfo.middle_name,
      actorEmployeeInfo.last_name,
      actorBorrowerInfo.first_name,
      actorBorrowerInfo.middle_name,
      actorBorrowerInfo.last_name,
    )
    .orderBy(asc(actorResolvedRoleNameSql))
    .catch(() => []);

  const deduped = new Map<string, AuditLogActorRoleOption>();

  for (const row of rows) {
    const resolvedRole = row.actorType === "system" ? "System" : row.actorRoleName;
    if (!resolvedRole) {
      continue;
    }

    deduped.set(resolvedRole, {
      value: resolvedRole,
      label: resolvedRole,
    });
  }

  return Array.from(deduped.values());
}

export async function loadAuditLogPageData(
  access: Extract<AuditLogPageAccess, { view: "ready" }>,
  filters: AuditLogFilters,
): Promise<AuditLogPageData> {
  const where = buildAuditLogWhere(access, filters);
  const actorRoleWhere = buildAuditLogWhere(access, filters, {
    omitActor: true,
    omitActorRole: true,
  });
  const actorWhere = buildAuditLogWhere(access, filters, {
    omitActor: true,
  });
  const pageSize = Math.min(Math.max(filters.pageSize, 10), 100);

  const [countRow, rows, branchOptions, actorRoleOptions, actorOptions] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(audit_logs)
      .where(where)
      .then((results) => Number(results[0]?.count) || 0)
      .catch(() => 0),
    db
      .select({
        auditLogId: audit_logs.audit_log_id,
        occurredAt: audit_logs.occurred_at,
        actorType: audit_logs.actor_type,
        actorDisplayName: actorResolvedDisplayNameSql,
        actorCompanyId: actorResolvedCompanyIdSql,
        actorRoleName: actorResolvedRoleNameSql,
        action: audit_logs.action,
        entityType: audit_logs.entity_type,
        entityId: audit_logs.entity_id,
        branchId: audit_logs.branch_id,
        branchCode: branch.branch_code,
        branchName: branch.branch_name,
        targetDisplayName: audit_logs.target_display_name,
        targetCompanyId: audit_logs.target_company_id,
        description: audit_logs.description,
        metadata: audit_logs.metadata,
        branchScope: audit_logs.branch_scope,
      })
      .from(audit_logs)
      .leftJoin(branch, eq(branch.branch_id, audit_logs.branch_id))
      .leftJoin(actorUsers, eq(actorUsers.user_id, audit_logs.actor_user_id))
      .leftJoin(actorRoles, eq(actorRoles.role_id, actorUsers.role_id))
      .leftJoin(actorEmployeeInfo, eq(actorEmployeeInfo.user_id, actorUsers.user_id))
      .leftJoin(actorBorrowerInfo, eq(actorBorrowerInfo.user_id, actorUsers.user_id))
      .where(where)
      .orderBy(desc(audit_logs.occurred_at), desc(audit_logs.audit_log_id))
      .limit(pageSize)
      .offset((filters.page - 1) * pageSize)
      .catch(() => []),
    db
      .select({
        branchId: branch.branch_id,
        branchCode: branch.branch_code,
        branchName: branch.branch_name,
      })
      .from(branch)
      .where(access.roleName === "Admin" ? undefined : inArray(branch.branch_id, access.allowedBranchIds))
      .orderBy(asc(branch.branch_name))
      .catch(() => []),
    loadActorRoleOptions(actorRoleWhere),
    loadActorOptions(actorWhere),
  ]);

  return {
    filters: {
      ...filters,
      pageSize,
    },
    rows: rows.map((row) => ({
      ...row,
      action: row.action as AuditAction,
      entityType: row.entityType as AuditEntityType,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      branchScope: row.branchScope ?? [],
    })),
    totalCount: countRow,
    branchOptions,
    actorRoleOptions,
    actorOptions,
  };
}
