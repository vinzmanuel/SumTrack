import "server-only";

import { asc, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { branch } from "@/db/schema";
import type { DashboardAuthResult } from "@/app/dashboard/auth";
import type {
  RecentActivityActorOption,
  RecentActivityBranchOption,
  RecentActivityFilters,
  RecentActivityItem,
  RecentActivityPageData,
  RecentActivityPreset,
  RecentActivityType,
  RecentActivityTypeFilter,
} from "@/app/dashboard/recent-activity/types";
import {
  RECENT_ACTIVITY_PAGE_SIZE,
  RECENT_ACTIVITY_PRESET_OPTIONS,
  RECENT_ACTIVITY_TYPE_OPTIONS,
} from "@/app/dashboard/recent-activity/types";

type RecentActivityAllowedRole = "Admin" | "Auditor" | "Branch Manager";

type RecentActivityAccess =
  | { view: "unauthenticated"; message: string }
  | { view: "forbidden"; message: string }
  | { view: "scope_error"; message: string }
  | {
      view: "ok";
      roleName: RecentActivityAllowedRole;
      viewerUserId: string;
      allowedBranchIds: number[];
      activeBranchId: number | null;
      activeBranchName: string | null;
    };

type ResolvedDateWindow = {
  fromDate: string | null;
  toDate: string | null;
  rangeLabel: string;
};

type RawRecentActivityRow = {
  activity_id: string;
  activity_type: RecentActivityType;
  activity_label: string;
  actor_user_id: string | null;
  actor_name: string;
  actor_role_name: string | null;
  subject_primary: string;
  context_label: string | null;
  detail_primary: string | null;
  detail_secondary: string | null;
  detail_tertiary: string | null;
  branch_label: string | null;
  occurred_at: string;
};

type RawActorOptionRow = {
  actor_user_id: string;
  actor_name: string;
  actor_role_name: string | null;
  last_seen_at: string;
};

const ACTIVITY_TYPE_VALUES = new Set(
  RECENT_ACTIVITY_TYPE_OPTIONS.map((option) => option.value),
);
const PRESET_VALUES = new Set(
  RECENT_ACTIVITY_PRESET_OPTIONS.map((option) => option.value),
);
const MANILA_TIME_ZONE = "Asia/Manila";

function pickFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInt(value: string | null | undefined) {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function isDateString(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function getTodayInManila() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shiftDate(dateString: string, offsetDays: number) {
  const value = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(value.getTime())) {
    return dateString;
  }

  value.setUTCDate(value.getUTCDate() + offsetDays);
  return value.toISOString().slice(0, 10);
}

function buildIntegerArraySql(values: number[]) {
  return sql`array[${sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  )}]::integer[]`;
}

function buildPersonDisplayNameSql(
  firstNameColumn: SQL,
  middleNameColumn: SQL,
  lastNameColumn: SQL,
) {
  return sql`
    nullif(
      trim(
        concat_ws(
          ' ',
          ${firstNameColumn},
          case
            when nullif(btrim(coalesce(${middleNameColumn}, '')), '') is not null
              then left(btrim(${middleNameColumn}), 1) || '.'
            else null
          end,
          ${lastNameColumn}
        )
      ),
      ''
    )
  `;
}

function buildActorFilterConditions(
  actorRoleColumn: SQL,
  filters: RecentActivityFilters,
) {
  const conditions: SQL[] = [];

  if (filters.actorRoleName) {
    conditions.push(sql`${actorRoleColumn} = ${filters.actorRoleName}`);
  }

  return conditions;
}

function buildActorVisibilityConditions(
  actorRoleColumn: SQL,
  access: Extract<RecentActivityAccess, { view: "ok" }>,
) {
  const conditions: SQL[] = [];

  if (access.roleName === "Branch Manager") {
    conditions.push(sql`${actorRoleColumn} = 'Secretary'`);
  }

  return conditions;
}

function buildActorUserConditions(
  actorUserColumn: SQL,
  filters: RecentActivityFilters,
) {
  const conditions: SQL[] = [];

  if (filters.actorUserId) {
    conditions.push(sql`${actorUserColumn} = ${filters.actorUserId}`);
  }

  return conditions;
}

function buildTimestampConditions(column: SQL, window: ResolvedDateWindow) {
  const conditions: SQL[] = [];

  if (window.fromDate) {
    conditions.push(sql`${column} >= ${`${window.fromDate} 00:00:00`}`);
  }

  if (window.toDate) {
    conditions.push(sql`${column} <= ${`${window.toDate} 23:59:59.999`}`);
  }

  return conditions;
}

function resolveScopedBranchIds(
  access: Extract<RecentActivityAccess, { view: "ok" }>,
  filters: RecentActivityFilters,
) {
  if (access.roleName === "Admin") {
    return filters.branchId ? [filters.branchId] : [];
  }

  if (access.roleName === "Branch Manager") {
    return access.activeBranchId ? [access.activeBranchId] : [];
  }

  if (filters.branchId) {
    return access.allowedBranchIds.includes(filters.branchId) ? [filters.branchId] : [];
  }

  return access.allowedBranchIds;
}

function buildScalarBranchConditions(
  branchColumn: SQL,
  access: Extract<RecentActivityAccess, { view: "ok" }>,
  filters: RecentActivityFilters,
) {
  const scopedBranchIds = resolveScopedBranchIds(access, filters);

  if (access.roleName === "Admin") {
    return scopedBranchIds.length > 0
      ? [sql`${branchColumn} = any(${buildIntegerArraySql(scopedBranchIds)})`]
      : [];
  }

  if (scopedBranchIds.length === 0) {
    return [sql`false`];
  }

  return [sql`${branchColumn} = any(${buildIntegerArraySql(scopedBranchIds)})`];
}

function buildArrayBranchConditions(
  branchArrayColumn: SQL,
  access: Extract<RecentActivityAccess, { view: "ok" }>,
  filters: RecentActivityFilters,
) {
  const scopedBranchIds = resolveScopedBranchIds(access, filters);

  if (access.roleName === "Admin") {
    return scopedBranchIds.length > 0
      ? [sql`${branchArrayColumn} && ${buildIntegerArraySql(scopedBranchIds)}`]
      : [];
  }

  if (scopedBranchIds.length === 0) {
    return [sql`false`];
  }

  return [sql`${branchArrayColumn} && ${buildIntegerArraySql(scopedBranchIds)}`];
}

function buildWhereClause(conditions: SQL[]) {
  if (conditions.length === 0) {
    return sql``;
  }

  return sql`where ${sql.join(conditions, sql` and `)}`;
}

function formatDateRangeLabel(fromDate: string | null, toDate: string | null, preset: RecentActivityPreset) {
  if (preset === "today") {
    return "Today";
  }

  if (preset === "7d") {
    return "Past 7 days";
  }

  if (preset === "30d") {
    return "Past 30 days";
  }

  if (preset === "180d") {
    return "Past 6 months";
  }

  if (preset === "lifetime") {
    return "Lifetime";
  }

  if (fromDate && toDate) {
    return `${fromDate} to ${toDate}`;
  }

  if (fromDate) {
    return `From ${fromDate}`;
  }

  if (toDate) {
    return `Until ${toDate}`;
  }

  return "Custom range";
}

function resolveDateWindow(filters: RecentActivityFilters): ResolvedDateWindow {
  const today = getTodayInManila();

  if (filters.preset === "today") {
    return {
      fromDate: today,
      toDate: today,
      rangeLabel: "Today",
    };
  }

  if (filters.preset === "7d") {
    return {
      fromDate: shiftDate(today, -6),
      toDate: today,
      rangeLabel: "Past 7 days",
    };
  }

  if (filters.preset === "180d") {
    return {
      fromDate: shiftDate(today, -179),
      toDate: today,
      rangeLabel: "Past 6 months",
    };
  }

  if (filters.preset === "lifetime") {
    return {
      fromDate: null,
      toDate: null,
      rangeLabel: "Lifetime",
    };
  }

  if (filters.preset === "custom") {
    const normalizedFrom = filters.fromDate && isDateString(filters.fromDate) ? filters.fromDate : null;
    const normalizedTo = filters.toDate && isDateString(filters.toDate) ? filters.toDate : null;

    return {
      fromDate: normalizedFrom,
      toDate: normalizedTo,
      rangeLabel: formatDateRangeLabel(normalizedFrom, normalizedTo, "custom"),
    };
  }

  return {
    fromDate: shiftDate(today, -29),
    toDate: today,
    rangeLabel: "Past 30 days",
  };
}

function shouldIncludeType(filters: RecentActivityFilters, value: RecentActivityType) {
  return filters.activityType === "all" || filters.activityType === value;
}

function buildActorDirectoryCte() {
  return sql`
    actor_directory as (
      select
        u.user_id,
        coalesce(
          ${buildPersonDisplayNameSql(sql`ei.first_name`, sql`ei.middle_name`, sql`ei.last_name`)},
          ${buildPersonDisplayNameSql(sql`bi.first_name`, sql`bi.middle_name`, sql`bi.last_name`)},
          nullif(trim(u.username), ''),
          nullif(trim(u.company_id), ''),
          u.user_id::text
        ) as actor_name,
        r.role_name
      from users u
      left join roles r on r.role_id = u.role_id
      left join employee_info ei on ei.user_id = u.user_id
      left join borrower_info bi on bi.user_id = u.user_id
    )
  `;
}

function buildAccountCreatedSelect(params: {
  access: Extract<RecentActivityAccess, { view: "ok" }>;
  filters: RecentActivityFilters;
  window: ResolvedDateWindow;
  includeActorFilter: boolean;
}) {
  if (!shouldIncludeType(params.filters, "account_created")) {
    return null;
  }

  if (params.access.roleName !== "Admin" || params.filters.branchId !== null) {
    return null;
  }

  const conditions: SQL[] = [
    sql`target.created_by is not null`,
    sql`target.date_created is not null`,
    sql`target_role.role_name <> 'Borrower'`,
    ...buildTimestampConditions(sql`target.date_created`, params.window),
  ];

  if (params.includeActorFilter) {
    conditions.push(
      ...buildActorVisibilityConditions(sql`actor.role_name`, params.access),
      ...buildActorFilterConditions(
        sql`actor.role_name`,
        params.filters,
      ),
      ...buildActorUserConditions(sql`actor.user_id`, params.filters),
    );
  } else {
    conditions.push(...buildActorVisibilityConditions(sql`actor.role_name`, params.access));
  }

  return sql`
    select
      concat('account_created:', target.user_id::text) as activity_id,
      'account_created'::text as activity_type,
      'Account created'::text as activity_label,
      target.date_created as occurred_at,
      actor.user_id as actor_user_id,
      actor.actor_name as actor_name,
      actor.role_name as actor_role_name,
      target_role.role_name as subject_primary,
      case
        when target_role.role_name = 'Admin' then 'Global / Unscoped'
        when target_role.role_name = 'Auditor' then
          case
            when coalesce(initial_branch_scope.branch_count, 0) = 0 then 'Unassigned'
            when initial_branch_scope.branch_count = 1 then '1 branch'
            else initial_branch_scope.branch_count::text || ' branches'
          end
        when target_role.role_name in ('Branch Manager', 'Secretary') then coalesce(initial_primary_branch.branch_display, 'Unassigned')
        when target_role.role_name = 'Collector' then coalesce(initial_area_scope.branch_name, 'Unassigned')
        else 'Unassigned'
      end as context_label,
      coalesce(
        ${buildPersonDisplayNameSql(
          sql`target_employee.first_name`,
          sql`target_employee.middle_name`,
          sql`target_employee.last_name`,
        )},
        nullif(trim(target.username), ''),
        target.company_id
      ) as detail_primary,
      target.company_id as detail_secondary,
      case
        when target_role.role_name = 'Collector' then initial_area_scope.area_code
        else null::text
      end as detail_tertiary,
      case
        when target_role.role_name = 'Admin' then 'Global / Unscoped'
        when target_role.role_name = 'Auditor' then
          case
            when coalesce(initial_branch_scope.branch_count, 0) = 0 then 'Unassigned'
            when initial_branch_scope.branch_count = 1 then '1 branch'
            else initial_branch_scope.branch_count::text || ' branches'
          end
        when target_role.role_name in ('Branch Manager', 'Secretary') then coalesce(initial_primary_branch.branch_display, 'Unassigned')
        when target_role.role_name = 'Collector' then coalesce(initial_area_scope.branch_name, 'Unassigned')
        else 'Unassigned'
      end as branch_label
    from users target
    inner join roles target_role on target_role.role_id = target.role_id
    inner join actor_directory actor on actor.user_id = target.created_by
    left join employee_info target_employee on target_employee.user_id = target.user_id
    left join lateral (
      select
        initial_assignment.start_date
      from employee_branch_assignment initial_assignment
      where initial_assignment.employee_user_id = target.user_id
      order by initial_assignment.start_date asc, initial_assignment.assignment_id asc
      limit 1
    ) initial_branch_anchor on true
    left join lateral (
      select
        count(*)::int as branch_count,
        string_agg(
          coalesce(initial_branch.branch_code, initial_branch.branch_name),
          ', '
          order by initial_branch.branch_name
        ) as branch_names
      from employee_branch_assignment initial_assignment
      inner join branch initial_branch on initial_branch.branch_id = initial_assignment.branch_id
      where
        initial_assignment.employee_user_id = target.user_id
        and initial_branch_anchor.start_date is not null
        and initial_assignment.start_date = initial_branch_anchor.start_date
    ) initial_branch_scope on true
    left join lateral (
      select
        initial_branch.branch_name as branch_display
      from employee_branch_assignment initial_assignment
      inner join branch initial_branch on initial_branch.branch_id = initial_assignment.branch_id
      where
        initial_assignment.employee_user_id = target.user_id
        and initial_branch_anchor.start_date is not null
        and initial_assignment.start_date = initial_branch_anchor.start_date
      order by initial_assignment.assignment_id asc
      limit 1
    ) initial_primary_branch on true
    left join lateral (
      select
        initial_branch.branch_name,
        initial_branch.branch_code,
        initial_area.area_code
      from employee_area_assignment initial_area_assignment
      inner join areas initial_area on initial_area.area_id = initial_area_assignment.area_id
      inner join branch initial_branch on initial_branch.branch_id = initial_area.branch_id
      where
        initial_area_assignment.employee_user_id = target.user_id
      order by initial_area_assignment.start_date asc, initial_area_assignment.assignment_id asc
      limit 1
    ) initial_area_scope on true
    ${buildWhereClause(conditions)}
  `;
}

function buildBorrowerCreatedSelect(params: {
  access: Extract<RecentActivityAccess, { view: "ok" }>;
  filters: RecentActivityFilters;
  window: ResolvedDateWindow;
  includeActorFilter: boolean;
}) {
  if (!shouldIncludeType(params.filters, "borrower_created")) {
    return null;
  }

  const conditions: SQL[] = [
    sql`target.created_by is not null`,
    sql`target.date_created is not null`,
    sql`target_role.role_name = 'Borrower'`,
    ...buildTimestampConditions(sql`target.date_created`, params.window),
    ...buildScalarBranchConditions(sql`br.branch_id`, params.access, params.filters),
  ];

  if (params.includeActorFilter) {
    conditions.push(
      ...buildActorVisibilityConditions(sql`actor.role_name`, params.access),
      ...buildActorFilterConditions(
        sql`actor.role_name`,
        params.filters,
      ),
      ...buildActorUserConditions(sql`actor.user_id`, params.filters),
    );
  } else {
    conditions.push(...buildActorVisibilityConditions(sql`actor.role_name`, params.access));
  }

  return sql`
    select
      concat('borrower_created:', target.user_id::text) as activity_id,
      'borrower_created'::text as activity_type,
      'Borrower created'::text as activity_label,
      target.date_created as occurred_at,
      actor.user_id as actor_user_id,
      actor.actor_name as actor_name,
      actor.role_name as actor_role_name,
      target.company_id as subject_primary,
      coalesce(
        ${buildPersonDisplayNameSql(sql`borrower.first_name`, sql`borrower.middle_name`, sql`borrower.last_name`)},
        'Borrower account'
      ) as context_label,
      coalesce(
        ${buildPersonDisplayNameSql(sql`borrower.first_name`, sql`borrower.middle_name`, sql`borrower.last_name`)},
        'Borrower account'
      ) as detail_primary,
      target.company_id as detail_secondary,
      area.area_code as detail_tertiary,
      br.branch_name as branch_label
    from users target
    inner join roles target_role on target_role.role_id = target.role_id
    inner join borrower_info borrower on borrower.user_id = target.user_id
    inner join areas area on area.area_id = borrower.area_id
    inner join branch br on br.branch_id = area.branch_id
    inner join actor_directory actor on actor.user_id = target.created_by
    ${buildWhereClause(conditions)}
  `;
}

function buildLoanCreatedSelect(params: {
  access: Extract<RecentActivityAccess, { view: "ok" }>;
  filters: RecentActivityFilters;
  window: ResolvedDateWindow;
  includeActorFilter: boolean;
}) {
  if (!shouldIncludeType(params.filters, "loan_created")) {
    return null;
  }

  const conditions: SQL[] = [
    sql`loan.created_by is not null`,
    sql`loan.created_at is not null`,
    ...buildTimestampConditions(sql`loan.created_at`, params.window),
    ...buildScalarBranchConditions(sql`loan.branch_id`, params.access, params.filters),
  ];

  if (params.includeActorFilter) {
    conditions.push(
      ...buildActorVisibilityConditions(sql`actor.role_name`, params.access),
      ...buildActorFilterConditions(
        sql`actor.role_name`,
        params.filters,
      ),
      ...buildActorUserConditions(sql`actor.user_id`, params.filters),
    );
  } else {
    conditions.push(...buildActorVisibilityConditions(sql`actor.role_name`, params.access));
  }

  return sql`
    select
      concat('loan_created:', loan.loan_id::text) as activity_id,
      'loan_created'::text as activity_type,
      'Loan created'::text as activity_label,
      loan.created_at as occurred_at,
      actor.user_id as actor_user_id,
      actor.actor_name as actor_name,
      actor.role_name as actor_role_name,
      loan.loan_code as subject_primary,
      null::text as context_label,
      concat(
        coalesce(
          ${buildPersonDisplayNameSql(
            sql`borrower.first_name`,
            sql`borrower.middle_name`,
            sql`borrower.last_name`,
          )},
          borrower_user.company_id
        ),
        ' (',
        borrower_user.company_id,
        ')'
      ) as detail_primary,
      null::text as detail_secondary,
      null::text as detail_tertiary,
      br.branch_name as branch_label
    from loan_records loan
    inner join users borrower_user on borrower_user.user_id = loan.borrower_id
    left join borrower_info borrower on borrower.user_id = borrower_user.user_id
    inner join branch br on br.branch_id = loan.branch_id
    inner join actor_directory actor on actor.user_id = loan.created_by
    ${buildWhereClause(conditions)}
  `;
}

function buildCollectionRecordedSelect(params: {
  access: Extract<RecentActivityAccess, { view: "ok" }>;
  filters: RecentActivityFilters;
  window: ResolvedDateWindow;
  includeActorFilter: boolean;
}) {
  if (!shouldIncludeType(params.filters, "collection_recorded")) {
    return null;
  }

  const conditions: SQL[] = [
    sql`collection.created_at is not null`,
    sql`not (collection.amount = 0 and btrim(coalesce(collection.note, '')) <> '')`,
    ...buildTimestampConditions(sql`collection.created_at`, params.window),
    ...buildScalarBranchConditions(sql`loan.branch_id`, params.access, params.filters),
  ];

  if (params.includeActorFilter) {
    conditions.push(
      ...buildActorVisibilityConditions(sql`actor.role_name`, params.access),
      ...buildActorFilterConditions(
        sql`actor.role_name`,
        params.filters,
      ),
      ...buildActorUserConditions(sql`actor.user_id`, params.filters),
    );
  } else {
    conditions.push(...buildActorVisibilityConditions(sql`actor.role_name`, params.access));
  }

  return sql`
    select
      concat('collection_recorded:', collection.collection_id::text) as activity_id,
      'collection_recorded'::text as activity_type,
      'Collection recorded'::text as activity_label,
      collection.created_at as occurred_at,
      actor.user_id as actor_user_id,
      actor.actor_name as actor_name,
      actor.role_name as actor_role_name,
      collection.collection_code as subject_primary,
      concat('For loan ', loan.loan_code) as context_label,
      concat('PHP ', to_char(collection.amount, 'FM999,999,990.00')) as detail_primary,
      concat(
        coalesce(
          ${buildPersonDisplayNameSql(
            sql`borrower.first_name`,
            sql`borrower.middle_name`,
            sql`borrower.last_name`,
          )},
          borrower_user.company_id
        ),
        ' (',
        borrower_user.company_id,
        ')'
      ) as detail_secondary,
      null::text as detail_tertiary,
      br.branch_name as branch_label
    from collections collection
    inner join loan_records loan on loan.loan_id = collection.loan_id
    inner join users borrower_user on borrower_user.user_id = loan.borrower_id
    left join borrower_info borrower on borrower.user_id = borrower_user.user_id
    inner join branch br on br.branch_id = loan.branch_id
    inner join actor_directory actor on actor.user_id = collection.encoded_by
    ${buildWhereClause(conditions)}
  `;
}

function buildMissedPaymentRecordedSelect(params: {
  access: Extract<RecentActivityAccess, { view: "ok" }>;
  filters: RecentActivityFilters;
  window: ResolvedDateWindow;
  includeActorFilter: boolean;
}) {
  if (!shouldIncludeType(params.filters, "missed_payment_recorded")) {
    return null;
  }

  const conditions: SQL[] = [
    sql`collection.created_at is not null`,
    sql`collection.amount = 0`,
    sql`btrim(coalesce(collection.note, '')) <> ''`,
    ...buildTimestampConditions(sql`collection.created_at`, params.window),
    ...buildScalarBranchConditions(sql`loan.branch_id`, params.access, params.filters),
  ];

  if (params.includeActorFilter) {
    conditions.push(
      ...buildActorVisibilityConditions(sql`actor.role_name`, params.access),
      ...buildActorFilterConditions(
        sql`actor.role_name`,
        params.filters,
      ),
      ...buildActorUserConditions(sql`actor.user_id`, params.filters),
    );
  } else {
    conditions.push(...buildActorVisibilityConditions(sql`actor.role_name`, params.access));
  }

  return sql`
    select
      concat('missed_payment_recorded:', collection.collection_id::text) as activity_id,
      'missed_payment_recorded'::text as activity_type,
      'Missed payment recorded'::text as activity_label,
      collection.created_at as occurred_at,
      actor.user_id as actor_user_id,
      actor.actor_name as actor_name,
      actor.role_name as actor_role_name,
      collection.collection_code as subject_primary,
      concat('For loan ', loan.loan_code, ' - ', left(btrim(collection.note), 120)) as context_label,
      concat('PHP ', to_char(collection.amount, 'FM999,999,990.00')) as detail_primary,
      concat(
        coalesce(
          ${buildPersonDisplayNameSql(
            sql`borrower.first_name`,
            sql`borrower.middle_name`,
            sql`borrower.last_name`,
          )},
          borrower_user.company_id
        ),
        ' (',
        borrower_user.company_id,
        ')'
      ) as detail_secondary,
      null::text as detail_tertiary,
      br.branch_name as branch_label
    from collections collection
    inner join loan_records loan on loan.loan_id = collection.loan_id
    inner join users borrower_user on borrower_user.user_id = loan.borrower_id
    left join borrower_info borrower on borrower.user_id = borrower_user.user_id
    inner join branch br on br.branch_id = loan.branch_id
    inner join actor_directory actor on actor.user_id = collection.encoded_by
    ${buildWhereClause(conditions)}
  `;
}

function buildExpenseRecordedSelect(params: {
  access: Extract<RecentActivityAccess, { view: "ok" }>;
  filters: RecentActivityFilters;
  window: ResolvedDateWindow;
  includeActorFilter: boolean;
}) {
  if (!shouldIncludeType(params.filters, "expense_recorded")) {
    return null;
  }

  const conditions: SQL[] = [
    sql`expense.recorded_at is not null`,
    ...buildTimestampConditions(sql`expense.recorded_at`, params.window),
    ...buildScalarBranchConditions(sql`expense.branch_id`, params.access, params.filters),
  ];

  if (params.includeActorFilter) {
    conditions.push(
      ...buildActorVisibilityConditions(sql`actor.role_name`, params.access),
      ...buildActorFilterConditions(
        sql`actor.role_name`,
        params.filters,
      ),
      ...buildActorUserConditions(sql`actor.user_id`, params.filters),
    );
  } else {
    conditions.push(...buildActorVisibilityConditions(sql`actor.role_name`, params.access));
  }

  return sql`
    select
      concat('expense_recorded:', expense.expense_id::text) as activity_id,
      'expense_recorded'::text as activity_type,
      'Expense recorded'::text as activity_label,
      expense.recorded_at as occurred_at,
      actor.user_id as actor_user_id,
      actor.actor_name as actor_name,
      actor.role_name as actor_role_name,
      concat(expense.expense_category, ' expense') as subject_primary,
      concat(
        'PHP ',
        to_char(expense.amount, 'FM999,999,990.00'),
        case
          when btrim(coalesce(expense.description, '')) <> '' then concat(' - ', left(expense.description, 120))
          else ''
        end
      ) as context_label,
      null::text as detail_primary,
      null::text as detail_secondary,
      null::text as detail_tertiary,
      br.branch_name as branch_label
    from expenses expense
    inner join branch br on br.branch_id = expense.branch_id
    inner join actor_directory actor on actor.user_id = expense.recorded_by
    ${buildWhereClause(conditions)}
  `;
}

function buildIncentiveRuleCreatedSelect(params: {
  access: Extract<RecentActivityAccess, { view: "ok" }>;
  filters: RecentActivityFilters;
  window: ResolvedDateWindow;
  includeActorFilter: boolean;
}) {
  if (!shouldIncludeType(params.filters, "incentive_rule_created")) {
    return null;
  }

  const conditions: SQL[] = [
    sql`rule.created_by is not null`,
    sql`rule.created_at is not null`,
    ...buildTimestampConditions(sql`rule.created_at`, params.window),
    ...buildScalarBranchConditions(sql`rule.branch_id`, params.access, params.filters),
  ];

  if (params.includeActorFilter) {
    conditions.push(
      ...buildActorVisibilityConditions(sql`actor.role_name`, params.access),
      ...buildActorFilterConditions(
        sql`actor.role_name`,
        params.filters,
      ),
      ...buildActorUserConditions(sql`actor.user_id`, params.filters),
    );
  } else {
    conditions.push(...buildActorVisibilityConditions(sql`actor.role_name`, params.access));
  }

  return sql`
    select
      concat('incentive_rule_created:', rule.rule_id::text) as activity_id,
      'incentive_rule_created'::text as activity_type,
      'Incentive rule created'::text as activity_label,
      rule.created_at as occurred_at,
      actor.user_id as actor_user_id,
      actor.actor_name as actor_name,
      actor.role_name as actor_role_name,
      concat(target_role.role_name, ' incentive rule') as subject_primary,
      concat(
        to_char(rule.percent_value, 'FM990.00'),
        '% / PHP ',
        to_char(rule.flat_amount, 'FM999,999,990.00')
      ) as context_label,
      null::text as detail_primary,
      null::text as detail_secondary,
      null::text as detail_tertiary,
      br.branch_name as branch_label
    from incentive_rules rule
    inner join roles target_role on target_role.role_id = rule.role_id
    inner join branch br on br.branch_id = rule.branch_id
    inner join actor_directory actor on actor.user_id = rule.created_by
    ${buildWhereClause(conditions)}
  `;
}

function buildReportGeneratedSelect(params: {
  access: Extract<RecentActivityAccess, { view: "ok" }>;
  filters: RecentActivityFilters;
  window: ResolvedDateWindow;
  includeActorFilter: boolean;
}) {
  if (!shouldIncludeType(params.filters, "report_generated")) {
    return null;
  }

  const conditions: SQL[] = [
    ...buildTimestampConditions(sql`report.generated_at`, params.window),
    ...buildArrayBranchConditions(sql`report.branch_scope`, params.access, params.filters),
  ];

  if (params.includeActorFilter) {
    conditions.push(
      ...buildActorVisibilityConditions(sql`actor.role_name`, params.access),
      ...buildActorFilterConditions(
        sql`actor.role_name`,
        params.filters,
      ),
      ...buildActorUserConditions(sql`actor.user_id`, params.filters),
    );
  } else {
    conditions.push(...buildActorVisibilityConditions(sql`actor.role_name`, params.access));
  }

  return sql`
    select
      concat('report_generated:', report.report_id::text) as activity_id,
      'report_generated'::text as activity_type,
      'Report generated'::text as activity_label,
      report.generated_at as occurred_at,
      actor.user_id as actor_user_id,
      case
        when report.generated_type = 'system' then 'System'::text
        else actor.actor_name
      end as actor_name,
      case
        when report.generated_type = 'system' then 'System'::text
        else actor.role_name
      end as actor_role_name,
      report.title as subject_primary,
      case
        when report.generated_type = 'system' then 'System-generated report'
        else initcap(report.report_category) || ' report'
      end as context_label,
      null::text as detail_primary,
      null::text as detail_secondary,
      null::text as detail_tertiary,
      case
        when coalesce(array_length(report.branch_scope, 1), 0) = 0 then null
        when array_length(report.branch_scope, 1) = 1 then (
          select scoped_branch.branch_name
          from branch scoped_branch
          where scoped_branch.branch_id = report.branch_scope[1]
        )
        else array_length(report.branch_scope, 1)::text || ' branches'
      end as branch_label
    from reports report
    inner join actor_directory actor on actor.user_id = report.generated_by
    ${buildWhereClause(conditions)}
  `;
}

function buildLoanDocumentUploadedSelect(params: {
  access: Extract<RecentActivityAccess, { view: "ok" }>;
  filters: RecentActivityFilters;
  window: ResolvedDateWindow;
  includeActorFilter: boolean;
}) {
  if (!shouldIncludeType(params.filters, "loan_document_uploaded")) {
    return null;
  }

  const conditions: SQL[] = [
    sql`doc.uploaded_by is not null`,
    sql`doc.uploaded_at is not null`,
    ...buildTimestampConditions(sql`doc.uploaded_at`, params.window),
    ...buildScalarBranchConditions(sql`loan.branch_id`, params.access, params.filters),
  ];

  if (params.includeActorFilter) {
    conditions.push(
      ...buildActorVisibilityConditions(sql`actor.role_name`, params.access),
      ...buildActorFilterConditions(
        sql`actor.role_name`,
        params.filters,
      ),
      ...buildActorUserConditions(sql`actor.user_id`, params.filters),
    );
  } else {
    conditions.push(...buildActorVisibilityConditions(sql`actor.role_name`, params.access));
  }

  return sql`
    select
      concat('loan_document_uploaded:', doc.loan_doc_id::text) as activity_id,
      'loan_document_uploaded'::text as activity_type,
      'Loan document uploaded'::text as activity_label,
      doc.uploaded_at as occurred_at,
      actor.user_id as actor_user_id,
      actor.actor_name as actor_name,
      actor.role_name as actor_role_name,
      concat(initcap(replace(doc.document_type, '_', ' ')), ' document') as subject_primary,
      concat('For loan ', loan.loan_code) as context_label,
      null::text as detail_primary,
      null::text as detail_secondary,
      null::text as detail_tertiary,
      br.branch_name as branch_label
    from loan_docs doc
    inner join loan_records loan on loan.loan_id = doc.loan_id
    inner join branch br on br.branch_id = loan.branch_id
    inner join actor_directory actor on actor.user_id = doc.uploaded_by
    ${buildWhereClause(conditions)}
  `;
}

function buildBorrowerDocumentUploadedSelect(params: {
  access: Extract<RecentActivityAccess, { view: "ok" }>;
  filters: RecentActivityFilters;
  window: ResolvedDateWindow;
  includeActorFilter: boolean;
}) {
  if (!shouldIncludeType(params.filters, "borrower_document_uploaded")) {
    return null;
  }

  const conditions: SQL[] = [
    sql`doc.uploaded_by is not null`,
    sql`doc.uploaded_at is not null`,
    ...buildTimestampConditions(sql`doc.uploaded_at`, params.window),
    ...buildScalarBranchConditions(sql`br.branch_id`, params.access, params.filters),
  ];

  if (params.includeActorFilter) {
    conditions.push(
      ...buildActorVisibilityConditions(sql`actor.role_name`, params.access),
      ...buildActorFilterConditions(
        sql`actor.role_name`,
        params.filters,
      ),
      ...buildActorUserConditions(sql`actor.user_id`, params.filters),
    );
  } else {
    conditions.push(...buildActorVisibilityConditions(sql`actor.role_name`, params.access));
  }

  return sql`
    select
      concat('borrower_document_uploaded:', doc.borrower_doc_id::text) as activity_id,
      'borrower_document_uploaded'::text as activity_type,
      'Borrower document uploaded'::text as activity_label,
      doc.uploaded_at as occurred_at,
      actor.user_id as actor_user_id,
      actor.actor_name as actor_name,
      actor.role_name as actor_role_name,
      concat(initcap(replace(doc.document_type, '_', ' ')), ' document') as subject_primary,
      concat('For borrower ', borrower_user.company_id) as context_label,
      null::text as detail_primary,
      null::text as detail_secondary,
      null::text as detail_tertiary,
      br.branch_name as branch_label
    from borrower_docs doc
    inner join borrower_info borrower on borrower.user_id = doc.borrower_id
    inner join users borrower_user on borrower_user.user_id = borrower.user_id
    inner join areas area on area.area_id = borrower.area_id
    inner join branch br on br.branch_id = area.branch_id
    inner join actor_directory actor on actor.user_id = doc.uploaded_by
    ${buildWhereClause(conditions)}
  `;
}

function buildEmptyActivitySelect() {
  return sql`
    select
      ''::text as activity_id,
      'account_created'::text as activity_type,
      ''::text as activity_label,
      now()::timestamp as occurred_at,
      null::uuid as actor_user_id,
      ''::text as actor_name,
      null::text as actor_role_name,
      ''::text as subject_primary,
      null::text as context_label,
      null::text as detail_primary,
      null::text as detail_secondary,
      null::text as detail_tertiary,
      null::text as branch_label
    where false
  `;
}

function buildRecentActivityUnionSql(params: {
  access: Extract<RecentActivityAccess, { view: "ok" }>;
  filters: RecentActivityFilters;
  includeActorFilter: boolean;
}) {
  const window = resolveDateWindow(params.filters);
  const selects = [
    buildAccountCreatedSelect({ ...params, window }),
    buildBorrowerCreatedSelect({ ...params, window }),
    buildLoanCreatedSelect({ ...params, window }),
    buildCollectionRecordedSelect({ ...params, window }),
    buildMissedPaymentRecordedSelect({ ...params, window }),
    buildExpenseRecordedSelect({ ...params, window }),
    buildIncentiveRuleCreatedSelect({ ...params, window }),
    buildReportGeneratedSelect({ ...params, window }),
    buildLoanDocumentUploadedSelect({ ...params, window }),
    buildBorrowerDocumentUploadedSelect({ ...params, window }),
  ].filter((value): value is SQL => value !== null);

  if (selects.length === 0) {
    return buildEmptyActivitySelect();
  }

  return sql.join(
    selects.map((selectSql) => sql`(${selectSql})`),
    sql` union all `,
  );
}

function buildRecentActivityCountQuery(
  access: Extract<RecentActivityAccess, { view: "ok" }>,
  filters: RecentActivityFilters,
) {
  const unionSql = buildRecentActivityUnionSql({
    access,
    filters,
    includeActorFilter: true,
  });

  return sql`
    with
      ${buildActorDirectoryCte()},
      recent_activity as (
        ${unionSql}
      )
    select count(*)::int as total_count
    from recent_activity
  `;
}

function buildRecentActivityRowsQuery(
  access: Extract<RecentActivityAccess, { view: "ok" }>,
  filters: RecentActivityFilters,
  page: number,
) {
  const unionSql = buildRecentActivityUnionSql({
    access,
    filters,
    includeActorFilter: true,
  });
  const offset = (page - 1) * RECENT_ACTIVITY_PAGE_SIZE;

  return sql`
    with
      ${buildActorDirectoryCte()},
      recent_activity as (
        ${unionSql}
      )
    select
      activity_id,
      activity_type,
      activity_label,
      actor_user_id,
      actor_name,
      actor_role_name,
      subject_primary,
      context_label,
      detail_primary,
      detail_secondary,
      detail_tertiary,
      branch_label,
      occurred_at
    from recent_activity
    order by occurred_at desc, activity_id desc
    limit ${RECENT_ACTIVITY_PAGE_SIZE}
    offset ${offset}
  `;
}

function buildRecentActivityActorOptionsQuery(
  access: Extract<RecentActivityAccess, { view: "ok" }>,
  filters: RecentActivityFilters,
) {
  const unionSql = buildRecentActivityUnionSql({
    access,
    filters,
    includeActorFilter: false,
  });

  return sql`
    with
      ${buildActorDirectoryCte()},
      recent_activity as (
        ${unionSql}
      )
    select
      actor_user_id,
      actor_name,
      actor_role_name,
      max(occurred_at) as last_seen_at
    from recent_activity
    where actor_user_id is not null
    group by actor_user_id, actor_name, actor_role_name
    order by max(occurred_at) desc, actor_name asc
    limit 100
  `;
}

function mapRecentActivityRow(row: RawRecentActivityRow): RecentActivityItem {
  return {
    activityId: row.activity_id,
    activityType: row.activity_type,
    activityLabel: row.activity_label,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    actorRoleName: row.actor_role_name,
    subjectPrimary: row.subject_primary,
    contextLabel: row.context_label,
    detailPrimary: row.detail_primary,
    detailSecondary: row.detail_secondary,
    detailTertiary: row.detail_tertiary,
    branchLabel: row.branch_label,
    occurredAt: row.occurred_at,
  };
}

async function loadBranchOptions(access: Extract<RecentActivityAccess, { view: "ok" }>) {
  if (access.roleName === "Admin") {
    return db
      .select({ branchId: branch.branch_id, branchName: branch.branch_name })
      .from(branch)
      .orderBy(asc(branch.branch_name))
      .catch(() => []) as Promise<RecentActivityBranchOption[]>;
  }

  if (access.allowedBranchIds.length === 0) {
    return [] as RecentActivityBranchOption[];
  }

  return db
    .select({ branchId: branch.branch_id, branchName: branch.branch_name })
    .from(branch)
    .where(inArray(branch.branch_id, access.allowedBranchIds))
    .orderBy(asc(branch.branch_name))
    .catch(() => []) as Promise<RecentActivityBranchOption[]>;
}

function buildScopeLabel(
  access: Extract<RecentActivityAccess, { view: "ok" }>,
  branchOptions: RecentActivityBranchOption[],
  filters: RecentActivityFilters,
) {
  if (filters.branchId) {
    const selectedBranch = branchOptions.find((option) => option.branchId === filters.branchId);
    return selectedBranch?.branchName ?? "Selected branch";
  }

  if (access.roleName === "Admin") {
    return "All branches";
  }

  if (access.roleName === "Branch Manager") {
    return access.activeBranchName ?? "Assigned branch";
  }

  return branchOptions.length === 1
    ? branchOptions[0]!.branchName
    : `${branchOptions.length} assigned branches`;
}

export function parseRecentActivityFilters(
  rawSearchParams: Record<string, string | string[] | undefined>,
): RecentActivityFilters {
  const presetRaw = pickFirstParam(rawSearchParams.preset);
  const activityTypeRaw = pickFirstParam(rawSearchParams.activity);
  const actorRoleRaw = pickFirstParam(rawSearchParams.actorRole)?.trim() ?? "";
  const actorRaw = pickFirstParam(rawSearchParams.actor)?.trim() ?? "";
  const fromRaw = pickFirstParam(rawSearchParams.from)?.trim() ?? "";
  const toRaw = pickFirstParam(rawSearchParams.to)?.trim() ?? "";

  const preset = PRESET_VALUES.has((presetRaw ?? "") as RecentActivityPreset)
    ? ((presetRaw ?? "30d") as RecentActivityPreset)
    : "30d";

  const activityType = ACTIVITY_TYPE_VALUES.has((activityTypeRaw ?? "") as RecentActivityTypeFilter)
    ? ((activityTypeRaw ?? "all") as RecentActivityTypeFilter)
    : "all";

  return {
    preset,
    fromDate: isDateString(fromRaw) ? fromRaw : null,
    toDate: isDateString(toRaw) ? toRaw : null,
    activityType,
    actorRoleName: actorRoleRaw ? actorRoleRaw : null,
    actorUserId: actorRaw ? actorRaw : null,
    branchId: parsePositiveInt(pickFirstParam(rawSearchParams.branch)),
    page: parsePositiveInt(pickFirstParam(rawSearchParams.page)) ?? 1,
  };
}

export function resolveRecentActivityAccess(auth: DashboardAuthResult): RecentActivityAccess {
  if (!auth.ok) {
    return {
      view: auth.reason === "unauthenticated" ? "unauthenticated" : "forbidden",
      message: auth.message,
    };
  }

  if (auth.roleName !== "Admin" && auth.roleName !== "Auditor" && auth.roleName !== "Branch Manager") {
    return {
      view: "forbidden",
      message: "You are not authorized to view recent operational activity.",
    };
  }

  if (auth.roleName === "Auditor" && auth.assignedBranchIds.length === 0) {
    return {
      view: "scope_error",
      message: "No assigned audit branches were found for your account.",
    };
  }

  if (auth.roleName === "Branch Manager" && auth.activeBranchId === null) {
    return {
      view: "scope_error",
      message: "Recent Activity needs a single active branch assignment for your account.",
    };
  }

  return {
    view: "ok",
    roleName: auth.roleName,
    viewerUserId: auth.userId,
    allowedBranchIds: auth.assignedBranchIds,
    activeBranchId: auth.activeBranchId,
    activeBranchName: auth.activeBranchName,
  };
}

export async function loadRecentActivityPageData(
  access: Extract<RecentActivityAccess, { view: "ok" }>,
  filters: RecentActivityFilters,
): Promise<RecentActivityPageData> {
  const [branchOptions, rawCountResult, rawActorRows] = await Promise.all([
    loadBranchOptions(access),
    db.execute(buildRecentActivityCountQuery(access, filters)).catch(() => []),
    db.execute(buildRecentActivityActorOptionsQuery(access, filters)).catch(() => []),
  ]);

  const countRows = Array.from(rawCountResult as Iterable<{ total_count?: number | string }>);
  const totalCount = Number(countRows[0]?.total_count) || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / RECENT_ACTIVITY_PAGE_SIZE));
  const safePage = Math.min(Math.max(filters.page, 1), totalPages);

  const rawRowsResult = await db
    .execute(buildRecentActivityRowsQuery(access, filters, safePage))
    .catch(() => []);
  const rows = Array.from(rawRowsResult as Iterable<RawRecentActivityRow>).map(mapRecentActivityRow);

  const actorOptions = Array.from(rawActorRows as Iterable<RawActorOptionRow>).map((row) => ({
    userId: row.actor_user_id,
    displayName: row.actor_name,
    roleName: row.actor_role_name,
  })) as RecentActivityActorOption[];

  const window = resolveDateWindow(filters);

  return {
    items: rows,
    actorOptions,
    branchOptions,
    totalCount,
    page: safePage,
    pageSize: RECENT_ACTIVITY_PAGE_SIZE,
    hasMore: safePage * RECENT_ACTIVITY_PAGE_SIZE < totalCount,
    scopeLabel: buildScopeLabel(access, branchOptions, filters),
    rangeLabel: window.rangeLabel,
  };
}
