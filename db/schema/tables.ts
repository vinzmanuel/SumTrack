import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  foreignKey,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

export const roles = pgTable(
  "roles",
  {
    role_id: integer().primaryKey().generatedAlwaysAsIdentity({
      name: "roles_role_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    role_name: varchar({ length: 50 }).notNull(),
  },
  (table) => [unique("roles_role_name_key").on(table.role_name)],
);

export const branch = pgTable(
  "branch",
  {
    branch_id: integer().primaryKey().generatedAlwaysAsIdentity({
      name: "branch_branch_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    province_name: varchar({ length: 100 }).notNull(),
    province_code: varchar({ length: 20 }).notNull(),
    municipality_name: varchar({ length: 100 }).notNull(),
    municipality_code: varchar({ length: 20 }).notNull(),
    branch_code: varchar({ length: 50 }).notNull(),
    branch_name: varchar({ length: 100 }).notNull(),
    branch_address: text().notNull(),
    status: text()
      .$type<"active" | "inactive">()
      .notNull()
      .default("active"),
    date_created: timestamp({ mode: "string" }).defaultNow(),
  },
  (table) => [
    unique("branch_branch_code_key").on(table.branch_code),
    check(
      "branch_status_check",
      sql`${table.status} in ('active', 'inactive')`
    ),
    index("branch_status_idx").on(table.status),
  ],
);

export const areas = pgTable(
  "areas",
  {
    area_id: integer().primaryKey().generatedAlwaysAsIdentity({
      name: "areas_area_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    branch_id: integer().notNull(),
    area_no: varchar({ length: 2 }).notNull(),
    area_code: varchar({ length: 80 }).notNull(),
    description: text("description"),
    status: text()
      .$type<"active" | "inactive">()
      .notNull()
      .default("active"),
    date_created: timestamp({ mode: "string" }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.branch_id],
      foreignColumns: [branch.branch_id],
      name: "areas_branch_id_fkey",
    }),
    unique("uq_areas_branch_area_no").on(table.branch_id, table.area_no),
    unique("areas_area_code_key").on(table.area_code),
    check("chk_areas_area_no_format", sql`(area_no)::text ~ '^[0-9]{2}$'::text`),
    check(
      "area_status_check",
      sql`${table.status} in ('active', 'inactive')`
    ),
    index("areas_status_idx").on(table.status),
  ],
);

export const users = pgTable(
  "users",
  {
    user_id: uuid("user_id").primaryKey().notNull(),
    company_id: varchar("company_id", { length: 80 }).notNull(),
    username: varchar("username", { length: 80 }).notNull(),
    role_id: integer("role_id").notNull(),
    date_created: timestamp("date_created", { mode: "string" }).defaultNow(),
    contact_no: varchar("contact_no", { length: 30 }),
    email: varchar("email", { length: 120 }),

    status: text("status")
      .$type<"active" | "inactive">()
      .notNull()
      .default("active"),

    created_by: uuid("created_by"),
    updated_at: timestamp("updated_at", { mode: "string" }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.role_id],
      foreignColumns: [roles.role_id],
      name: "users_role_id_fkey",
    }),
    foreignKey({
      columns: [table.created_by],
      foreignColumns: [table.user_id],
      name: "users_created_by_fkey",
    }).onDelete("set null"),
    unique("users_company_id_key").on(table.company_id),
    unique("users_username_key").on(table.username),
    check(
      "users_contact_no_check",
      sql`${table.contact_no} is null or ${table.contact_no} ~ '^09[0-9]{9}$'`
    ),
    check(
      "users_status_check",
      sql`${table.status} in ('active', 'inactive')`
    ),
    index("users_status_idx").on(table.status),
    index("users_role_status_idx").on(table.role_id, table.status),
  ]
);

export const employee_info = pgTable(
  "employee_info",
  {
    user_id: uuid().primaryKey().notNull(),
    first_name: varchar({ length: 100 }).notNull(),
    middle_name: varchar({ length: 100 }),
    last_name: varchar({ length: 100 }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.user_id],
      foreignColumns: [users.user_id],
      name: "employee_info_user_id_fkey",
    }),
  ],
);

export const borrower_info = pgTable(
  "borrower_info",
  {
    user_id: uuid().primaryKey().notNull(),
    first_name: varchar({ length: 100 }).notNull(),
    middle_name: varchar({ length: 100 }),
    last_name: varchar({ length: 100 }).notNull(),
    address: text(),
    area_id: integer().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.area_id],
      foreignColumns: [areas.area_id],
      name: "borrower_info_area_id_fkey",
    }),
    foreignKey({
      columns: [table.user_id],
      foreignColumns: [users.user_id],
      name: "borrower_info_user_id_fkey",
    }),
    index("borrower_info_area_id_idx").on(table.area_id),
  ],
);

export const employee_branch_assignment = pgTable(
  "employee_branch_assignment",
  {
    assignment_id: integer().primaryKey().generatedAlwaysAsIdentity({
      name: "employee_branch_assignment_assignment_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    employee_user_id: uuid().notNull(),
    branch_id: integer().notNull(),
    start_date: date().notNull(),
    end_date: date(),
  },
  (table) => [
    uniqueIndex("uq_employee_branch_assignment_active_same_branch")
      .on(table.employee_user_id, table.branch_id)
      .where(sql`(end_date IS NULL)`),
    foreignKey({
      columns: [table.branch_id],
      foreignColumns: [branch.branch_id],
      name: "employee_branch_assignment_branch_id_fkey",
    }),
    foreignKey({
      columns: [table.employee_user_id],
      foreignColumns: [employee_info.user_id],
      name: "employee_branch_assignment_employee_user_id_fkey",
    }),
    index("employee_branch_assignment_branch_id_idx").on(table.branch_id),
    check(
      "chk_employee_branch_assignment_dates",
      sql`(end_date IS NULL) OR (end_date >= start_date)`,
    ),
  ],
);

export const employee_area_assignment = pgTable(
  "employee_area_assignment",
  {
    assignment_id: integer().primaryKey().generatedAlwaysAsIdentity({
      name: "employee_area_assignment_assignment_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    employee_user_id: uuid().notNull(),
    area_id: integer().notNull(),
    start_date: date().notNull(),
    end_date: date(),
  },
  (table) => [
    uniqueIndex("uq_employee_area_assignment_active_one")
      .on(table.employee_user_id)
      .where(sql`(end_date IS NULL)`),
    foreignKey({
      columns: [table.area_id],
      foreignColumns: [areas.area_id],
      name: "employee_area_assignment_area_id_fkey",
    }),
    foreignKey({
      columns: [table.employee_user_id],
      foreignColumns: [employee_info.user_id],
      name: "employee_area_assignment_employee_user_id_fkey",
    }),
    index("employee_area_assignment_area_id_idx").on(table.area_id),
    check("chk_employee_area_assignment_dates", sql`(end_date IS NULL) OR (end_date >= start_date)`),
  ],
);

export const loan_records = pgTable(
  "loan_records",
  {
    loan_id: integer().primaryKey().generatedAlwaysAsIdentity({
      name: "loan_records_loan_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    loan_code: varchar({ length: 160 }).notNull(),
    borrower_id: uuid().notNull(),
    principal: numeric({ precision: 10, scale: 2 }).notNull(),
    interest: numeric({ precision: 10, scale: 2 }).notNull(),
    collector_id: uuid(),
    start_date: date().notNull(),
    due_date: date().notNull(),
    term_days: integer(),
    branch_id: integer().notNull(),
    created_at: timestamp({ mode: "string" }).defaultNow(),
    created_by: uuid(),
    status: varchar({ length: 50 })
      .$type<"active" | "overdue" | "completed" | "archived" | "abandoned">()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.collector_id],
      foreignColumns: [users.user_id],
      name: "loan_records_collector_id_fkey",
    }),
    foreignKey({
      columns: [table.borrower_id],
      foreignColumns: [borrower_info.user_id],
      name: "loan_records_borrower_id_fkey",
    }),
    foreignKey({
      columns: [table.branch_id],
      foreignColumns: [branch.branch_id],
      name: "loan_records_branch_id_fkey",
    }),
    foreignKey({
      columns: [table.created_by],
      foreignColumns: [users.user_id],
      name: "loan_records_created_by_fkey",
    }).onDelete("set null"),
    unique("loan_records_loan_code_key").on(table.loan_code),
    index("loan_records_borrower_id_idx").on(table.borrower_id),
    index("loan_records_collector_id_idx").on(table.collector_id),
    index("loan_records_branch_id_idx").on(table.branch_id),
    check("chk_loan_records_interest_nonnegative", sql`interest >= (0)::numeric`),
    check("chk_loan_records_principal_nonnegative", sql`principal >= (0)::numeric`),
    check(
      "loan_records_status_check",
      sql`${table.status} in ('active', 'overdue', 'completed', 'archived', 'abandoned')`
    ),

    check(
      "chk_loan_records_term_days_positive",
      sql`${table.term_days} IS NULL OR ${table.term_days} > 0`
    ),
  ],
);

export const collections = pgTable(
  "collections",
  {
    collection_id: integer().primaryKey().generatedAlwaysAsIdentity({
      name: "collections_collection_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    collection_code: varchar({ length: 200 }).notNull(),
    loan_id: integer().notNull(),
    collector_id: uuid("collector_id"),
    amount: numeric({ precision: 10, scale: 2 }).notNull(),
    note: text(),
    encoded_by: uuid().notNull(),
    collection_date: date().notNull(),
    created_at: timestamp({ mode: "string" }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.encoded_by],
      foreignColumns: [users.user_id],
      name: "collections_encoded_by_fkey",
    }),
    foreignKey({
      columns: [table.loan_id],
      foreignColumns: [loan_records.loan_id],
      name: "collections_loan_id_fkey",
    }),
    foreignKey({
      columns: [table.collector_id],
      foreignColumns: [users.user_id],
      name: "collections_collector_id_fkey",
    }).onDelete("set null"),
    unique("collections_collection_code_key").on(table.collection_code),
    check("chk_collections_amount_nonnegative", sql`amount >= (0)::numeric`),
    index("collections_loan_id_collection_date_idx").on(
      table.loan_id,
      table.collection_date
    ),
    index("collections_collector_id_idx").on(table.collector_id),
    index("collections_collection_date_idx").on(table.collection_date),
    index("collections_encoded_by_idx").on(table.encoded_by),
  ],
);

export const expenses = pgTable(
  "expenses",
  {
    expense_id: integer().primaryKey().generatedAlwaysAsIdentity({
      name: "expenses_expense_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    branch_id: integer().notNull(),
    amount: numeric({ precision: 10, scale: 2 }).notNull(),
    expense_category: varchar({ length: 50 }).notNull(),
    description: text().notNull(),
    expense_date: date().notNull(),
    recorded_by: uuid().notNull(),
    recorded_at: timestamp({ mode: "string" }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.branch_id],
      foreignColumns: [branch.branch_id],
      name: "fk_expenses_branch",
    }),
    foreignKey({
      columns: [table.recorded_by],
      foreignColumns: [users.user_id],
      name: "fk_expenses_recorded_by",
    }),
    check("chk_expenses_amount_nonnegative", sql`amount >= (0)::numeric`),
    check(
      "chk_expenses_category",
      sql`${table.expense_category} in (
        'Rent',
        'Electricity',
        'Water',
        'Transportation',
        'Lunch',
        'Salary',
        'Miscellaneous'
      )`,
    ),
    index("expenses_branch_id_expense_date_idx").on(
      table.branch_id,
      table.expense_date
    ),
    index("expenses_recorded_by_idx").on(table.recorded_by),
  ],
);

export const incentive_rules = pgTable(
  "incentive_rules",
  {
    rule_id: integer().primaryKey().generatedAlwaysAsIdentity({
      name: "incentive_rules_rule_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    branch_id: integer().notNull(),
    role_id: integer().notNull(),
    percent_value: numeric({ precision: 5, scale: 2 }).notNull(),
    flat_amount: numeric({ precision: 10, scale: 2 }).notNull(),
    effective_start: date().notNull(),
    effective_end: date(),
    created_by: uuid(),
    created_at: timestamp({ mode: "string" }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.branch_id],
      foreignColumns: [branch.branch_id],
      name: "fk_incentive_rules_branch",
    }),
    foreignKey({
      columns: [table.role_id],
      foreignColumns: [roles.role_id],
      name: "fk_incentive_rules_role",
    }),
    foreignKey({
      columns: [table.created_by],
      foreignColumns: [users.user_id],
      name: "fk_incentive_rules_created_by",
    }),
    unique("uq_incentive_rules_branch_role_effective_start").on(
      table.branch_id,
      table.role_id,
      table.effective_start,
    ),
    check(
      "chk_incentive_rules_flat_amount_nonnegative",
      sql`${table.flat_amount} >= 0`,
    ),
    check(
      "chk_incentive_rules_percent_nonnegative",
      sql`${table.percent_value} >= 0`,
    ),
    check(
      "chk_incentive_rules_not_both_zero",
      sql`${table.percent_value} > 0 OR ${table.flat_amount} > 0`,
    ),
    check(
      "chk_incentive_rules_effective_dates",
      sql`${table.effective_end} IS NULL OR ${table.effective_end} >= ${table.effective_start}`,
    ),
  ],
);

export const incentive_payout_batches = pgTable(
  "incentive_payout_batches",
  {
    batch_id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({
      name: "incentive_payout_batches_batch_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 9223372036854775807,
      cache: 1,
    }),
    branch_id: integer().notNull(),
    period_label: varchar({ length: 50 }).notNull(),
    period_start: date().notNull(),
    period_end: date().notNull(),
    finalized_by: uuid().notNull(),
    finalized_at: timestamp({ mode: "string" }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.branch_id],
      foreignColumns: [branch.branch_id],
      name: "fk_incentive_payout_batches_branch",
    }),
    foreignKey({
      columns: [table.finalized_by],
      foreignColumns: [users.user_id],
      name: "fk_incentive_payout_batches_finalized_by",
    }),
    unique("uq_incentive_payout_batches_branch_period").on(
      table.branch_id,
      table.period_start,
      table.period_end,
    ),
    check(
      "chk_incentive_payout_batches_dates",
      sql`${table.period_end} >= ${table.period_start}`,
    ),
  ],
);

export const incentive_payout_history = pgTable(
  "incentive_payout_history",
  {
    payout_id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({
      name: "incentive_payout_history_payout_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 9223372036854775807,
      cache: 1,
    }),
    batch_id: bigint({ mode: "number" }).notNull(),
    employee_user_id: uuid().notNull(),
    role_id: integer().notNull(),
    base_amount: numeric({ precision: 12, scale: 2 }).notNull(),
    percent_value: numeric({ precision: 5, scale: 2 }).notNull(),
    flat_amount: numeric({ precision: 12, scale: 2 }).notNull(),
    computed_incentive: numeric({ precision: 12, scale: 2 }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.batch_id],
      foreignColumns: [incentive_payout_batches.batch_id],
      name: "fk_incentive_payout_history_batch",
    }),
    foreignKey({
      columns: [table.employee_user_id],
      foreignColumns: [users.user_id],
      name: "fk_incentive_payout_history_employee",
    }),
    foreignKey({
      columns: [table.role_id],
      foreignColumns: [roles.role_id],
      name: "fk_incentive_payout_history_role",
    }),
    unique("uq_incentive_payout_history_batch_employee").on(
      table.batch_id,
      table.employee_user_id,
    ),
    check(
      "chk_incentive_payout_history_base_nonnegative",
      sql`${table.base_amount} >= 0`,
    ),
    check(
      "chk_incentive_payout_history_percent_nonnegative",
      sql`${table.percent_value} >= 0`,
    ),
    check(
      "chk_incentive_payout_history_flat_nonnegative",
      sql`${table.flat_amount} >= 0`,
    ),
    check(
      "chk_incentive_payout_history_incentive_nonnegative",
      sql`${table.computed_incentive} >= 0`,
    ),
  ],
);

export const reports = pgTable(
  "reports",
  {
    report_id: integer("report_id")
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    title: varchar("title", { length: 160 }).notNull(),
    report_category: text("report_category")
      .$type<"analytics" | "document">()
      .notNull(),
    template_key: varchar("template_key", { length: 80 }).notNull(),
    generated_type: text("generated_type")
      .$type<"user" | "system">()
      .notNull()
      .default("user"),
    generated_by: uuid("generated_by").notNull(),
    generated_at: timestamp("generated_at", { mode: "string" })
      .notNull()
      .defaultNow(),
    filters: jsonb("filters").notNull(),
    branch_scope: integer("branch_scope")
      .array()
      .notNull()
      .default(sql`'{}'::integer[]`),
    date_from: date("date_from"),
    date_to: date("date_to"),
    source_entity_type: text("source_entity_type").$type<
      "loan" | "collection" | null
    >(),
    source_entity_id: integer("source_entity_id"),
    snapshot: jsonb("snapshot").notNull(),
    status: text("status")
      .$type<"active" | "archived">()
      .notNull()
      .default("active"),
  },
  (table) => [
    foreignKey({
      columns: [table.generated_by],
      foreignColumns: [users.user_id],
      name: "reports_generated_by_fkey",
    }),
    check(
      "reports_report_category_check",
      sql`${table.report_category} in ('analytics', 'document')`
    ),
    check(
      "reports_generated_type_check",
      sql`${table.generated_type} in ('user', 'system')`
    ),
    check(
      "reports_source_entity_type_check",
      sql`${table.source_entity_type} is null or ${table.source_entity_type} in ('loan', 'collection')`
    ),
    check(
      "reports_status_check",
      sql`${table.status} in ('active', 'archived')`
    ),
    index("reports_generated_at_idx").on(table.generated_at),
    index("reports_generated_by_idx").on(table.generated_by),
    index("reports_report_category_idx").on(table.report_category),
    index("reports_template_key_idx").on(table.template_key),
    index("reports_generated_type_idx").on(table.generated_type),
    index("reports_status_idx").on(table.status),
    index("reports_status_generated_at_idx").on(
      table.status,
      table.generated_at
    ),
    index("reports_generated_by_status_generated_at_idx").on(
      table.generated_by,
      table.status,
      table.generated_at
    ),
    index("reports_source_entity_lookup_idx").on(
      table.source_entity_type,
      table.source_entity_id
    ),
    index("reports_date_from_idx").on(table.date_from),
    index("reports_date_to_idx").on(table.date_to),
    index("reports_branch_scope_gin_idx").using("gin", table.branch_scope),
    index("reports_system_recipient_role_idx")
      .on(sql`((filters ->> 'systemRecipientRole'))`)
      .where(sql`${table.generated_type} = 'system'`),
    index("reports_system_recipient_user_idx")
      .on(sql`((filters ->> 'systemRecipientUserId'))`)
      .where(sql`${table.generated_type} = 'system'`),
    index("reports_system_scope_key_idx")
      .on(sql`((filters ->> 'systemScopeKey'))`)
      .where(sql`${table.generated_type} = 'system'`),
    index("reports_system_coverage_month_idx")
      .on(sql`((filters ->> 'systemCoverageMonth'))`)
      .where(sql`${table.generated_type} = 'system'`),
  ]
);

export const audit_logs = pgTable(
  "audit_logs",
  {
    audit_log_id: bigint("audit_log_id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity({
        name: "audit_logs_audit_log_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 9223372036854775807,
        cache: 1,
      }),
    occurred_at: timestamp("occurred_at", { mode: "string", withTimezone: true }).notNull().defaultNow(),
    actor_type: text("actor_type")
      .$type<"user" | "system">()
      .notNull()
      .default("user"),
    actor_user_id: uuid("actor_user_id"),
    actor_company_id: varchar("actor_company_id", { length: 80 }),
    actor_display_name: text("actor_display_name"),
    actor_role_name: varchar("actor_role_name", { length: 80 }),
    action: varchar("action", { length: 120 }).notNull(),
    entity_type: varchar("entity_type", { length: 80 }).notNull(),
    entity_id: varchar("entity_id", { length: 160 }),
    branch_id: integer("branch_id"),
    branch_scope: integer("branch_scope")
      .array()
      .notNull()
      .default(sql`'{}'::integer[]`),
    target_user_id: uuid("target_user_id"),
    target_company_id: varchar("target_company_id", { length: 80 }),
    target_display_name: text("target_display_name"),
    description: text("description").notNull(),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    ip_address: varchar("ip_address", { length: 120 }),
    user_agent: text("user_agent"),
  },
  (table) => [
    foreignKey({
      columns: [table.actor_user_id],
      foreignColumns: [users.user_id],
      name: "audit_logs_actor_user_id_fkey",
    }).onDelete("set null"),
    foreignKey({
      columns: [table.branch_id],
      foreignColumns: [branch.branch_id],
      name: "audit_logs_branch_id_fkey",
    }).onDelete("set null"),
    foreignKey({
      columns: [table.target_user_id],
      foreignColumns: [users.user_id],
      name: "audit_logs_target_user_id_fkey",
    }).onDelete("set null"),
    check("audit_logs_actor_type_check", sql`${table.actor_type} in ('user', 'system')`),
    check(
      "audit_logs_actor_consistency_check",
      sql`(${table.actor_type} = 'system') or (${table.actor_type} = 'user' and ${table.actor_user_id} is not null)`,
    ),
    check(
      "audit_logs_action_check",
      sql`${table.action} in (
        'auth.login_succeeded',
        'auth.login_failed',
        'auth.logout',
        'auth.otp_sent',
        'auth.otp_verified',
        'auth.otp_failed',
        'auth.password_reset_requested',
        'auth.password_reset_completed',
          'user.created',
          'user.deactivated',
          'user.reactivated',
          'user.details_updated',
          'user.role_changed',
          'assignment.branch_started',
          'assignment.branch_ended',
          'assignment.area_started',
          'assignment.area_ended',
          'user.promoted',
          'user.reassigned',
          'user.deleted',
          'loan.created',
          'loan.deleted',
          'loan.status_changed_manual',
        'loan.status_changed_system',
        'loan.collector_changed',
        'collection.recorded',
        'expense.created',
        'document.uploaded',
        'document.deleted',
        'document.replaced',
        'report.generated',
        'report.exported',
        'report.generated_system_monthly',
        'incentive.rule_created',
        'incentive.batch_finalized',
        'incentive.payout_recorded',
        'incentive.report_generated'
      )`,
    ),
    check(
      "audit_logs_entity_type_check",
      sql`${table.entity_type} in (
        'auth',
        'user',
        'assignment',
        'loan',
        'collection',
        'expense',
        'document',
        'report',
        'incentive'
      )`,
    ),
    index("audit_logs_occurred_at_idx").on(table.occurred_at),
    index("audit_logs_action_occurred_at_idx").on(table.action, table.occurred_at),
    index("audit_logs_entity_lookup_idx").on(table.entity_type, table.entity_id),
    index("audit_logs_actor_user_occurred_at_idx").on(table.actor_user_id, table.occurred_at),
    index("audit_logs_target_user_occurred_at_idx").on(table.target_user_id, table.occurred_at),
    index("audit_logs_branch_occurred_at_idx").on(table.branch_id, table.occurred_at),
    index("audit_logs_branch_scope_gin_idx").using("gin", table.branch_scope),
  ],
);

export const loan_docs = pgTable(
  "loan_docs",
  {
    loan_doc_id: integer().primaryKey().generatedAlwaysAsIdentity({
      name: "loan_docs_loan_doc_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    loan_id: integer().notNull(),
    document_type: varchar({ length: 100 }).notNull(),
    file_path: text().notNull(),
    uploaded_by: uuid(),
    original_filename: text().notNull(),
    mime_type: text().notNull(),
    file_size: bigint({ mode: "number" }).notNull(),
    uploaded_at: timestamp({ mode: "string" }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.loan_id],
      foreignColumns: [loan_records.loan_id],
      name: "loan_docs_loan_id_fkey",
    }),
    foreignKey({
      columns: [table.uploaded_by],
      foreignColumns: [users.user_id],
      name: "loan_docs_uploaded_by_fkey",
    }),
  ],
);

export const borrower_docs = pgTable(
  "borrower_docs",
  {
    borrower_doc_id: integer().primaryKey().generatedAlwaysAsIdentity({
      name: "borrower_docs_borrower_doc_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    borrower_id: uuid().notNull(),
    document_type: varchar({ length: 100 }).notNull(),
    file_path: text().notNull(),
    uploaded_by: uuid(),
    original_filename: text().notNull(),
    mime_type: text().notNull(),
    file_size: bigint({ mode: "number" }).notNull(),
    uploaded_at: timestamp({ mode: "string" }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.borrower_id],
      foreignColumns: [borrower_info.user_id],
      name: "borrower_docs_borrower_id_fkey",
    }),
    foreignKey({
      columns: [table.uploaded_by],
      foreignColumns: [users.user_id],
      name: "borrower_docs_uploaded_by_fkey",
    }),
  ],
);
