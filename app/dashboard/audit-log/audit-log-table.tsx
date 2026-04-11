"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AuditLogBranchOption, AuditLogRow } from "@/app/dashboard/audit-log/types";
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS } from "@/lib/audit/taxonomy";

const headerRowClassName = "border-border/70 bg-card";
const MONO_CLASS = "font-[family:var(--font-mono)] tabular-nums";
const EXPANDED_DETAIL_GRID_CLASS = "grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)]";

const auditTimestampFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const pesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

function getDisplayEntityLabel(entityType: AuditLogRow["entityType"]) {
  return AUDIT_ENTITY_LABELS[entityType];
}

function getIncentiveKind(metadata: Record<string, unknown>) {
  const kind = nestedMetadataString(metadata, "incentiveKind");
  if (kind === "rule" || kind === "batch" || kind === "payout") {
    return kind;
  }

  return null;
}

type DetailItem = {
  label: string;
  value: string;
  monospace?: boolean;
};

type ExpandedSection = {
  title: string;
  details: DetailItem[];
  rawMetadata?: string;
};

function formatTimestamp(value: string) {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return auditTimestampFormatter.format(parsedDate);
}

function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

function metadataString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function metadataNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function metadataObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function metadataNumberArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => metadataNumber(item))
    .filter((item): item is number => item !== null);
}

function nestedMetadataString(record: Record<string, unknown>, key: string) {
  const direct = metadataString(record[key]);
  if (direct) {
    return direct;
  }

  const oldValues = metadataObject(record.old_values);
  const newValues = metadataObject(record.new_values);
  const context = metadataObject(record.context);

  return (
    (newValues ? metadataString(newValues[key]) : null) ??
    (oldValues ? metadataString(oldValues[key]) : null) ??
    (context ? metadataString(context[key]) : null) ??
    null
  );
}

function joinReadable(values: Array<string | null | undefined>, separator = " / ") {
  return values.filter((value): value is string => Boolean(value && value.trim().length > 0)).join(separator);
}

function formatMoney(value: unknown) {
  const parsed = metadataNumber(value);
  if (parsed === null) {
    return null;
  }

  return pesoFormatter.format(parsed);
}

function resolveActionLabel(row: AuditLogRow) {
  if (row.action === "collection.recorded" && row.metadata?.missedPayment === true) {
    return "Missed payment recorded";
  }

  return AUDIT_ACTION_LABELS[row.action];
}

function entityBadgeClass(entityType: string) {
  if (entityType === "auth") {
    return "whitespace-nowrap rounded-md border border-blue-200 bg-blue-50 py-1 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300";
  }

  if (entityType === "user" || entityType === "assignment") {
    return "whitespace-nowrap rounded-md border border-amber-200 bg-amber-50 py-1 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300";
  }

  if (entityType === "loan" || entityType === "collection") {
    return "whitespace-nowrap rounded-md border border-emerald-200 bg-emerald-50 py-1 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300";
  }

  if (entityType === "expense" || entityType === "report") {
    return "whitespace-nowrap rounded-md border border-violet-200 bg-violet-50 py-1 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300";
  }

  return "whitespace-nowrap rounded-md border border-zinc-200 bg-zinc-50 py-1 text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100";
}

function actorRoleBadgeClass(roleName: string | null, actorType: "user" | "system") {
  if (actorType === "system") {
    return "whitespace-nowrap rounded-md border border-zinc-200 bg-zinc-50 py-1 text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100";
  }

  if (roleName === "Admin") {
    return "whitespace-nowrap rounded-md border border-red-200 bg-red-50 py-1 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300";
  }

  if (roleName === "Auditor") {
    return "whitespace-nowrap rounded-md border border-blue-200 bg-blue-50 py-1 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300";
  }

  if (roleName === "Branch Manager") {
    return "whitespace-nowrap rounded-md border border-amber-200 bg-amber-50 py-1 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300";
  }

  if (roleName === "Secretary") {
    return "whitespace-nowrap rounded-md border border-violet-200 bg-violet-50 py-1 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300";
  }

  if (roleName === "Collector") {
    return "whitespace-nowrap rounded-md border border-emerald-200 bg-emerald-50 py-1 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300";
  }

  return "whitespace-nowrap rounded-md border border-zinc-200 bg-zinc-50 py-1 text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100";
}

function resolveActorLabel(row: AuditLogRow) {
  if (row.actorType === "system") {
    return "System";
  }

  return row.actorDisplayName ?? row.actorCompanyId ?? "Unknown user";
}

function resolvePrimaryBranchDisplay(row: AuditLogRow) {
  return row.branchCode ?? row.branchName ?? "Global / Unscoped";
}

function resolveSingleBranchScopeDisplay(row: AuditLogRow) {
  return row.branchName ?? row.branchCode ?? "Global / Unscoped";
}

function resolveScopeSummary(row: AuditLogRow) {
  if (row.entityType === "auth" || row.action.startsWith("auth.")) {
    return "Global / Unscoped";
  }

  if (row.branchScope.length === 0) {
    return "Global / Unscoped";
  }

  if (row.branchScope.length === 1) {
    return resolveSingleBranchScopeDisplay(row);
  }

  return `${row.branchScope.length} branches`;
}

function resolveTargetSummary(row: AuditLogRow) {
  const metadata = row.metadata ?? {};
  const loanCode = nestedMetadataString(metadata, "loanCode");
  const collectionCode =
    nestedMetadataString(metadata, "collectionCode") ?? nestedMetadataString(metadata, "triggeredByCollectionCode");
  const borrowerCompanyId = nestedMetadataString(metadata, "borrowerCompanyId");
  const borrowerName = nestedMetadataString(metadata, "borrowerName");
  const documentType = nestedMetadataString(metadata, "documentType");
  const templateLabel = nestedMetadataString(metadata, "templateLabel");
  const templateKey = nestedMetadataString(metadata, "templateKey");
  const category = nestedMetadataString(metadata, "category");
  const roleName = nestedMetadataString(metadata, "roleName");
  const periodLabel = nestedMetadataString(metadata, "periodLabel");
  const employeeName = nestedMetadataString(metadata, "employeeName");
  const branchLabel = row.branchCode ?? row.branchName ?? nestedMetadataString(metadata, "branchName");
  const incentiveKind = getIncentiveKind(metadata);

  if (row.entityType === "loan") {
    return loanCode ?? borrowerCompanyId ?? borrowerName ?? row.entityId ?? "-";
  }

  if (row.entityType === "collection") {
    return collectionCode ?? loanCode ?? row.entityId ?? "-";
  }

  if (row.entityType === "user" || row.entityType === "assignment") {
    return (
      joinReadable(
        row.targetDisplayName && row.targetCompanyId
          ? [`${row.targetDisplayName} (${row.targetCompanyId})`]
          : [row.targetDisplayName, row.targetCompanyId],
      ) || "-"
    );
  }

  if (row.entityType === "expense") {
    return category ?? `Expense #${row.entityId ?? row.auditLogId}`;
  }

  if (row.entityType === "document") {
    return documentType ?? "Document";
  }

  if (row.entityType === "report") {
    return templateLabel ?? templateKey ?? `Report #${row.entityId ?? row.auditLogId}`;
  }

  if (row.entityType === "incentive") {
    if (incentiveKind === "rule") {
      return joinReadable([roleName, branchLabel]) || "Incentive rule";
    }

    if (incentiveKind === "batch") {
      return joinReadable([branchLabel, periodLabel]) || "Incentive batch";
    }

    if (incentiveKind === "payout") {
      return (
        joinReadable(
          row.targetDisplayName && row.targetCompanyId
            ? [`${row.targetDisplayName} (${row.targetCompanyId})`]
            : [row.targetDisplayName, row.targetCompanyId, employeeName],
        ) || "Incentive payout"
      );
    }

    return "Incentive";
  }

  if (row.entityType === "auth") {
    return row.actorCompanyId ?? row.targetCompanyId ?? row.targetDisplayName ?? "Authentication";
  }

  return row.targetDisplayName ?? row.targetCompanyId ?? getDisplayEntityLabel(row.entityType);
}

function resolveEntityReference(row: AuditLogRow) {
  const metadata = row.metadata ?? {};
  const loanCode = nestedMetadataString(metadata, "loanCode");
  const collectionCode =
    nestedMetadataString(metadata, "collectionCode") ?? nestedMetadataString(metadata, "triggeredByCollectionCode");
  const documentType = nestedMetadataString(metadata, "documentType");
  const templateLabel = nestedMetadataString(metadata, "templateLabel");
  const roleName = nestedMetadataString(metadata, "roleName");
  const periodLabel = nestedMetadataString(metadata, "periodLabel");
  const incentiveKind = getIncentiveKind(metadata);

  if (row.entityType === "loan") {
    return { label: "Loan Code", value: loanCode ?? row.entityId ?? "-", monospace: true };
  }

  if (row.entityType === "collection") {
    return { label: "Collection Code", value: collectionCode ?? row.entityId ?? "-", monospace: true };
  }

  if (row.entityType === "user" || row.entityType === "assignment") {
    return { label: "Company ID", value: row.targetCompanyId ?? row.entityId ?? "-", monospace: true };
  }

  if (row.entityType === "document") {
    return {
      label: "Document Reference",
      value: documentType ?? `Document #${row.entityId ?? "-"}`,
      monospace: !documentType,
    };
  }

  if (row.entityType === "report") {
    return {
      label: "Report Reference",
      value: templateLabel ?? `Report #${row.entityId ?? "-"}`,
      monospace: !templateLabel,
    };
  }

  if (row.entityType === "incentive") {
    if (incentiveKind === "rule") {
      return {
        label: "Rule Reference",
        value: roleName ?? row.entityId ?? "-",
        monospace: !roleName,
      };
    }

    if (incentiveKind === "batch") {
      return {
        label: "Batch Reference",
        value: periodLabel ?? row.entityId ?? "-",
        monospace: !periodLabel,
      };
    }

    if (incentiveKind === "payout") {
      return {
        label: "Payout Reference",
        value: row.targetCompanyId ?? row.entityId ?? "-",
        monospace: true,
      };
    }

    return { label: "Incentive Reference", value: row.entityId ?? "-", monospace: true };
  }

  return { label: "Entity Reference", value: row.entityId ?? "-", monospace: true };
}

function ExpandedDetailRows(props: {
  details: DetailItem[];
}) {
  return (
    <div className="space-y-3">
      {props.details.map((detail) => (
        <div
          className={`grid items-start gap-x-6 gap-y-1 border-b border-border/50 pb-3 last:border-b-0 last:pb-0 ${EXPANDED_DETAIL_GRID_CLASS}`}
          key={`${detail.label}-${detail.value}`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 md:pt-1">
            {detail.label}
          </p>
          <p
            className={`${detail.monospace ? `${MONO_CLASS} break-all ` : "break-words "}min-w-0 whitespace-normal text-sm leading-6 text-foreground`}
          >
            {detail.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function buildExpandedDetails(row: AuditLogRow, branchLookup: Map<number, AuditLogBranchOption>) {
  const metadata = row.metadata ?? {};
  const oldValues = metadataObject(metadata.old_values);
  const newValues = metadataObject(metadata.new_values);
  const incentiveKind = getIncentiveKind(metadata);
  const actorLabel = resolveActorLabel(row);
  const scopeSummary = resolveScopeSummary(row);
  const targetSummary = resolveTargetSummary(row);
  const primaryBranchDisplay = resolvePrimaryBranchDisplay(row);
  const entityReference = resolveEntityReference(row);
  const scopedBranchLabels = row.branchScope
    .map((branchId) => {
      const option = branchLookup.get(branchId);
      return option ? `${option.branchCode} (${option.branchName})` : null;
    })
    .filter((value): value is string => Boolean(value));
  const eventDetails: DetailItem[] = [];
  const peopleDetails: DetailItem[] = [];
  const contextDetails: DetailItem[] = [];
  const previousBranchScope = metadataNumberArray(oldValues?.branchIds)
    .map((branchId) => branchLookup.get(branchId)?.branchName ?? branchLookup.get(branchId)?.branchCode ?? `#${branchId}`)
    .join(", ");
  const nextBranchScope = metadataNumberArray(newValues?.branchIds)
    .map((branchId) => branchLookup.get(branchId)?.branchName ?? branchLookup.get(branchId)?.branchCode ?? `#${branchId}`)
    .join(", ");

  function pushDetail(
    bucket: DetailItem[],
    label: string,
    value: string | null | undefined,
    options?: { monospace?: boolean },
  ) {
    if (!value || value.trim().length === 0) {
      return;
    }

    bucket.push({
      label,
      value,
      monospace: options?.monospace,
    });
  }

  pushDetail(eventDetails, "Audit Log ID", `#${row.auditLogId}`, { monospace: true });
  pushDetail(eventDetails, "Timestamp", formatTimestamp(row.occurredAt), { monospace: true });
  pushDetail(eventDetails, "Action", resolveActionLabel(row));
  pushDetail(eventDetails, "Entity", getDisplayEntityLabel(row.entityType));
  pushDetail(eventDetails, entityReference.label, entityReference.value, { monospace: entityReference.monospace });
  pushDetail(eventDetails, "Remarks", row.description);

  pushDetail(peopleDetails, "Actor", actorLabel);
  pushDetail(peopleDetails, "Actor Role", row.actorType === "system" ? "System" : row.actorRoleName ?? "User");
  pushDetail(peopleDetails, "Actor Company ID", row.actorCompanyId, { monospace: true });
  pushDetail(peopleDetails, "Target", targetSummary);

  pushDetail(contextDetails, "Branch / Scope", scopeSummary);
  if (scopeSummary !== "Global / Unscoped" && row.branchScope.length > 1) {
    pushDetail(contextDetails, "Scoped Branches", scopedBranchLabels.join(", "));
  }
  if (scopeSummary !== "Global / Unscoped" && row.branchScope.length === 1) {
    pushDetail(contextDetails, "Primary Branch", primaryBranchDisplay);
  }

  if (row.entityType === "loan") {
    pushDetail(peopleDetails, "Borrower", nestedMetadataString(metadata, "borrowerName"));
    pushDetail(peopleDetails, "Borrower Company ID", nestedMetadataString(metadata, "borrowerCompanyId"), {
      monospace: true,
    });
    pushDetail(peopleDetails, "Collector", nestedMetadataString(metadata, "collectorName"));
    pushDetail(
      contextDetails,
      "Status",
      joinReadable(
        [nestedMetadataString(metadata, "previousStatus"), nestedMetadataString(metadata, "nextStatus")],
        " -> ",
      ) || nestedMetadataString(metadata, "status"),
    );
    pushDetail(contextDetails, "Principal", formatMoney(metadata.principal));
    pushDetail(contextDetails, "Interest", formatMoney(metadata.interest));
    pushDetail(contextDetails, "Start Date", nestedMetadataString(metadata, "startDate"));
    pushDetail(contextDetails, "Due Date", nestedMetadataString(metadata, "dueDate"));
    pushDetail(contextDetails, "Collection Count", nestedMetadataString(metadata, "collectionCount"));
    pushDetail(contextDetails, "Total Collected", formatMoney(metadata.totalCollected));
    pushDetail(contextDetails, "Remaining Balance", formatMoney(metadata.remainingBalance));
    pushDetail(contextDetails, "Triggered Collection", nestedMetadataString(metadata, "triggeredByCollectionCode"), {
      monospace: true,
    });
  }

  if (row.entityType === "collection") {
    pushDetail(eventDetails, "Loan Code", nestedMetadataString(metadata, "loanCode"), { monospace: true });
    pushDetail(peopleDetails, "Collector", nestedMetadataString(metadata, "collectorName"));
    pushDetail(contextDetails, "Collection Date", nestedMetadataString(metadata, "collectionDate"));
    pushDetail(contextDetails, "Amount", formatMoney(metadata.amount));
    pushDetail(
      contextDetails,
      "Missed Payment",
      typeof metadata.missedPayment === "boolean" ? (metadata.missedPayment ? "Yes" : "No") : null,
    );
    pushDetail(contextDetails, "Note", nestedMetadataString(metadata, "note"));
  }

  if (row.entityType === "expense") {
    pushDetail(eventDetails, "Category", nestedMetadataString(metadata, "category"));
    pushDetail(eventDetails, "Expense Description", nestedMetadataString(metadata, "description"));
    pushDetail(contextDetails, "Amount", formatMoney(metadata.amount));
    pushDetail(contextDetails, "Expense Date", nestedMetadataString(metadata, "expenseDate"));
    pushDetail(contextDetails, "Branch", nestedMetadataString(metadata, "branchName") ?? primaryBranchDisplay);
  }

  if (row.entityType === "document") {
    pushDetail(eventDetails, "Document Type", nestedMetadataString(metadata, "documentType"));
    pushDetail(contextDetails, "Subject Type", nestedMetadataString(metadata, "subjectType"));
    pushDetail(contextDetails, "Subject Reference", nestedMetadataString(metadata, "subjectId"), {
      monospace: true,
    });
    pushDetail(contextDetails, "Original Filename", nestedMetadataString(metadata, "originalFilename"));
    pushDetail(contextDetails, "Replacement Warning", nestedMetadataString(metadata, "replacementWarning"));
  }

  if (row.entityType === "report") {
    pushDetail(
      eventDetails,
      "Template",
      nestedMetadataString(metadata, "templateLabel") ?? nestedMetadataString(metadata, "templateKey"),
    );
    pushDetail(contextDetails, "Report Category", nestedMetadataString(metadata, "reportCategory"));
    pushDetail(contextDetails, "Month", nestedMetadataString(metadata, "month"));
    pushDetail(
      contextDetails,
      "Date Range",
      joinReadable(
        [nestedMetadataString(metadata, "dateFrom"), nestedMetadataString(metadata, "dateTo")],
        " to ",
      ),
    );
    pushDetail(
      contextDetails,
      "Source Entity",
      joinReadable(
        [nestedMetadataString(metadata, "sourceEntityType"), nestedMetadataString(metadata, "sourceEntityId")],
        " / ",
      ),
    );
    pushDetail(contextDetails, "Generated Type", nestedMetadataString(metadata, "generatedType"));
  }

  if (row.entityType === "incentive") {
    pushDetail(
      eventDetails,
      "Incentive Kind",
      incentiveKind === "rule"
        ? "Rule"
        : incentiveKind === "batch"
          ? "Batch"
          : incentiveKind === "payout"
            ? "Payout"
            : null,
    );

    if (incentiveKind === "rule") {
      const ruleDetails = metadataObject(metadata.ruleDetails);
      const percentValue = metadataNumber(ruleDetails?.percentValue);
      pushDetail(peopleDetails, "Role", nestedMetadataString(metadata, "roleName"));
      pushDetail(contextDetails, "Branch", nestedMetadataString(metadata, "branchName") ?? primaryBranchDisplay);
      pushDetail(contextDetails, "Mode", nestedMetadataString(metadata, "mode"));
      pushDetail(contextDetails, "Percent Value", percentValue !== null ? `${percentValue}%` : null);
      pushDetail(contextDetails, "Flat Amount", formatMoney(ruleDetails?.flatAmount));
      pushDetail(contextDetails, "Effective Start", metadataString(ruleDetails?.effectiveStart));
      pushDetail(contextDetails, "Effective End", metadataString(ruleDetails?.effectiveEnd));
      pushDetail(contextDetails, "Period Label", metadataString(ruleDetails?.periodLabel));
    }

    if (incentiveKind === "batch") {
      pushDetail(contextDetails, "Branch", nestedMetadataString(metadata, "branchName") ?? primaryBranchDisplay);
      pushDetail(contextDetails, "Period", nestedMetadataString(metadata, "periodLabel"));
      pushDetail(contextDetails, "Period Start", nestedMetadataString(metadata, "periodStart"));
      pushDetail(contextDetails, "Period End", nestedMetadataString(metadata, "periodEnd"));
      pushDetail(contextDetails, "Payout Rows", nestedMetadataString(metadata, "payoutRecordCount"));
    }

    if (incentiveKind === "payout") {
      const percentValue = metadataNumber(metadata.percentValue);
      pushDetail(peopleDetails, "Employee", nestedMetadataString(metadata, "employeeName") ?? row.targetDisplayName);
      pushDetail(peopleDetails, "Employee Company ID", row.targetCompanyId, { monospace: true });
      pushDetail(peopleDetails, "Role", nestedMetadataString(metadata, "roleName"));
      pushDetail(contextDetails, "Base Amount", formatMoney(metadata.baseAmount));
      pushDetail(contextDetails, "Percent Value", percentValue !== null ? `${percentValue}%` : null);
      pushDetail(contextDetails, "Flat Amount", formatMoney(metadata.flatAmount));
      pushDetail(contextDetails, "Computed Incentive", formatMoney(metadata.computedIncentive));
      pushDetail(contextDetails, "Period", nestedMetadataString(metadata, "periodLabel"));
    }
  }

  if (row.entityType === "auth") {
    pushDetail(contextDetails, "Channel", nestedMetadataString(metadata, "channel"));
    pushDetail(contextDetails, "Identifier Type", nestedMetadataString(metadata, "identifierType"));
    pushDetail(contextDetails, "Failure Reason", nestedMetadataString(metadata, "failureReason"));
    pushDetail(contextDetails, "Destination", nestedMetadataString(metadata, "destination"));
  }

  if (row.entityType === "user" || row.entityType === "assignment") {
    pushDetail(peopleDetails, "Target Role", nestedMetadataString(metadata, "roleName"));
    pushDetail(
      contextDetails,
      "Current Branch",
      nestedMetadataString(metadata, "branchCode") ?? nestedMetadataString(metadata, "branchName"),
    );
    pushDetail(contextDetails, "Current Area", nestedMetadataString(metadata, "areaCode"));
    pushDetail(
      contextDetails,
      "Previous Values",
      joinReadable(
        [
          nestedMetadataString(metadata, "previousRoleName"),
          nestedMetadataString(metadata, "previousBranchCode"),
          nestedMetadataString(metadata, "previousAreaCode"),
        ],
        " / ",
      ),
    );
    pushDetail(
      contextDetails,
      "New Values",
      joinReadable(
        [
          nestedMetadataString(metadata, "newRoleName"),
          nestedMetadataString(metadata, "newBranchCode"),
          nestedMetadataString(metadata, "newAreaCode"),
        ],
        " / ",
      ),
    );
    pushDetail(
      contextDetails,
      "Previous Branch Scope",
      previousBranchScope,
    );
    pushDetail(
      contextDetails,
      "New Branch Scope",
      nextBranchScope,
    );
    pushDetail(
      contextDetails,
      "Previous Area",
      nestedMetadataString(metadata, "previousAreaCode") ??
        metadataString(oldValues?.areaCode) ??
        (metadataNumber(oldValues?.areaId) !== null ? `Area #${metadataNumber(oldValues?.areaId)}` : null),
    );
    pushDetail(
      contextDetails,
      "New Area",
      nestedMetadataString(metadata, "newAreaCode") ??
        metadataString(newValues?.areaCode) ??
        (metadataNumber(newValues?.areaId) !== null ? `Area #${metadataNumber(newValues?.areaId)}` : null),
    );
  }

  const sections: ExpandedSection[] = [
    { title: "Event Context", details: eventDetails },
    { title: "Actor / Target", details: peopleDetails },
    { title: "Scope / Metadata", details: contextDetails, rawMetadata: prettyJson(metadata) },
  ];

  return sections.filter((section) => section.details.length > 0 || section.rawMetadata);
}

export function AuditLogTable({
  rows,
  branchOptions,
}: {
  rows: AuditLogRow[];
  branchOptions: AuditLogBranchOption[];
}) {
  const [expandedRows, setExpandedRows] = useState<number[]>([]);
  const branchLookup = useMemo(
    () => new Map(branchOptions.map((option) => [option.branchId, option])),
    [branchOptions],
  );

  function toggleRow(auditLogId: number) {
    setExpandedRows((current) =>
      current.includes(auditLogId)
        ? current.filter((value) => value !== auditLogId)
        : [...current, auditLogId],
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border/70 bg-card shadow-sm">
      <Table className="min-w-[1320px] table-fixed text-sm">
        <TableHeader>
          <TableRow className={headerRowClassName}>
            <TableHead className="h-auto w-[220px] py-3 pl-6">Timestamp</TableHead>
            <TableHead className="h-auto w-[320px] py-3">Entity / Action</TableHead>
            <TableHead className="h-auto w-[260px] py-3">Actor</TableHead>
            <TableHead className="h-auto w-[300px] py-3">Target</TableHead>
            <TableHead className="h-auto w-[164px] py-3">Branch / Scope</TableHead>
            <TableHead className="h-auto w-[56px] py-3 pr-5">
              <span className="sr-only">Expand</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell className="py-10 text-center text-sm text-muted-foreground" colSpan={6}>
                No audit events matched the current filters.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const expanded = expandedRows.includes(row.auditLogId);
              const actorLabel = resolveActorLabel(row);
              const targetSummary = resolveTargetSummary(row);
              const scopeSummary = resolveScopeSummary(row);
              const expandedSections = buildExpandedDetails(row, branchLookup);

              return (
                <Fragment key={row.auditLogId}>
                  <TableRow className="align-top hover:bg-zinc-50/60 dark:hover:bg-white/[0.03]">
                    <TableCell className="w-[220px] py-3 pl-6">
                      <p className={`${MONO_CLASS} text-sm font-[200] text-foreground`}>
                        {formatTimestamp(row.occurredAt)}
                      </p>
                    </TableCell>
                    <TableCell className="w-[320px] py-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Badge className={entityBadgeClass(row.entityType)} variant="outline">
                          {getDisplayEntityLabel(row.entityType)}
                        </Badge>
                        <p className="min-w-0 whitespace-normal break-words text-sm font-medium text-foreground">
                          {resolveActionLabel(row)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="w-[260px] py-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Badge className={actorRoleBadgeClass(row.actorRoleName, row.actorType)} variant="outline">
                          {row.actorType === "system" ? "System" : row.actorRoleName || "User"}
                        </Badge>
                        <p className="min-w-0 whitespace-normal break-words font-medium text-foreground">
                          {actorLabel}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="w-[300px] py-3">
                      <p className="min-w-0 whitespace-normal break-all text-sm text-foreground">{targetSummary}</p>
                    </TableCell>
                    <TableCell className="w-[164px] py-3">
                      <p className="min-w-0 whitespace-normal break-words text-sm text-foreground">{scopeSummary}</p>
                    </TableCell>
                    <TableCell className="py-3 pr-5">
                      <div className="flex justify-end">
                        <Button
                          aria-expanded={expanded}
                          className="h-9 w-9 rounded-md border-0 bg-transparent text-muted-foreground shadow-none hover:bg-accent hover:text-foreground dark:bg-transparent dark:hover:bg-white/[0.08]"
                          onClick={() => toggleRow(row.auditLogId)}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <span className="sr-only">{expanded ? "Collapse" : "Expand"} audit event {row.auditLogId}</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expanded ? (
                    <TableRow className="bg-zinc-50/60 dark:bg-white/[0.03]">
                      <TableCell className="px-5 pb-5 pt-0" colSpan={6}>
                        <div className="overflow-hidden border-t border-border/70 pt-4">
                          <div className="grid gap-4 lg:grid-cols-3">
                            {expandedSections.map((section) => (
                              <div className="rounded-md border border-border/60 bg-background/80 p-4" key={section.title}>
                                <p className="text-sm font-medium text-foreground">{section.title}</p>
                                {section.details.length > 0 ? (
                                  <div className="mt-3">
                                    <ExpandedDetailRows details={section.details} />
                                  </div>
                                ) : null}
                                {section.rawMetadata ? (
                                  <div className="mt-4 border-t border-border/50 pt-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                      Raw Metadata
                                    </p>
                                    <pre className="mt-3 max-h-80 min-w-0 overflow-auto whitespace-pre-wrap break-words rounded-md bg-background px-4 py-3 text-xs leading-5 text-foreground shadow-sm">
                                      {section.rawMetadata}
                                    </pre>
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
