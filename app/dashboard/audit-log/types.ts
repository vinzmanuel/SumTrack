import type { AuditAction, AuditEntityType } from "@/lib/audit/taxonomy";

export type AuditLogFilterAction =
  | AuditAction
  | "collection.payment_recorded"
  | "collection.missed_payment_recorded";

export type AuditLogFilterEntity = AuditEntityType;

export type AuditLogPageAccess =
  | {
      view: "ready";
      roleName: "Admin" | "Auditor" | "Branch Manager";
      userId: string;
      allowedBranchIds: number[];
      canChooseBranch: boolean;
    }
  | {
      view: "unauthenticated" | "forbidden" | "scope_error";
      message: string;
    };

export type AuditLogDatePreset = "today" | "7d" | "30d" | "90d" | "custom";

export type AuditLogFilters = {
  preset: AuditLogDatePreset;
  fromDate: string | null;
  toDate: string | null;
  branchId: number | null;
  action: AuditLogFilterAction | "all";
  entityType: AuditLogFilterEntity | "all";
  actorRole: string | "all";
  actor: string | "all";
  query: string;
  page: number;
  pageSize: number;
};

export type AuditLogBranchOption = {
  branchId: number;
  branchCode: string;
  branchName: string;
};

export type AuditLogActorOption = {
  actorKey: string;
  label: string;
};

export type AuditLogActorRoleOption = {
  value: string;
  label: string;
};

export type AuditLogRow = {
  auditLogId: number;
  occurredAt: string;
  actorType: "user" | "system";
  actorDisplayName: string | null;
  actorCompanyId: string | null;
  actorRoleName: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string | null;
  branchId: number | null;
  branchCode: string | null;
  branchName: string | null;
  targetDisplayName: string | null;
  targetCompanyId: string | null;
  description: string;
  metadata: Record<string, unknown>;
  branchScope: number[];
};

export type AuditLogPageData = {
  filters: AuditLogFilters;
  rows: AuditLogRow[];
  totalCount: number;
  branchOptions: AuditLogBranchOption[];
  actorRoleOptions: AuditLogActorRoleOption[];
  actorOptions: AuditLogActorOption[];
};
