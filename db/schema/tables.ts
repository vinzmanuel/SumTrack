import { sql } from "drizzle-orm";
import {
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
    date_created: timestamp({ mode: "string" }).defaultNow(),
  },
  (table) => [unique("branch_branch_code_key").on(table.branch_code)],
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
  ],
);

export const users = pgTable(
  "users",
  {
    user_id: uuid().primaryKey().notNull(),
    company_id: varchar({ length: 80 }).notNull(),
    username: varchar({ length: 80 }).notNull(),
    role_id: integer().notNull(),
    date_created: timestamp({ mode: "string" }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.role_id],
      foreignColumns: [roles.role_id],
      name: "users_role_id_fkey",
    }),
    unique("users_company_id_key").on(table.company_id),
    unique("users_username_key").on(table.username),
  ],
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
    contact_number: varchar({ length: 20 }),
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
    start_date: date().notNull(),
    due_date: date().notNull(),
    branch_id: integer().notNull(),
    status: varchar({ length: 50 }).notNull(),
  },
  (table) => [
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
    unique("loan_records_loan_code_key").on(table.loan_code),
    check("chk_loan_records_interest_nonnegative", sql`interest >= (0)::numeric`),
    check("chk_loan_records_principal_nonnegative", sql`principal >= (0)::numeric`),
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
    amount: numeric({ precision: 10, scale: 2 }).notNull(),
    note: text(),
    encoded_by: uuid().notNull(),
    collector_id: uuid().notNull(),
    collection_date: date().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.collector_id],
      foreignColumns: [users.user_id],
      name: "collections_collector_id_fkey",
    }),
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
    unique("collections_collection_code_key").on(table.collection_code),
    check("chk_collections_amount_nonnegative", sql`amount >= (0)::numeric`),
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
    description: text().notNull(),
    recorded_by: uuid().notNull(),
    recorded_at: timestamp({ mode: "string" }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.branch_id],
      foreignColumns: [branch.branch_id],
      name: "expenses_branch_id_fkey",
    }),
    foreignKey({
      columns: [table.recorded_by],
      foreignColumns: [users.user_id],
      name: "expenses_recorded_by_fkey",
    }),
    check("chk_expenses_amount_nonnegative", sql`amount >= (0)::numeric`),
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
  },
  (table) => [
    foreignKey({
      columns: [table.branch_id],
      foreignColumns: [branch.branch_id],
      name: "incentive_rules_branch_id_fkey",
    }),
    foreignKey({
      columns: [table.role_id],
      foreignColumns: [roles.role_id],
      name: "incentive_rules_role_id_fkey",
    }),
    check("chk_incentive_rules_flat_amount_nonnegative", sql`flat_amount >= (0)::numeric`),
    check("chk_incentive_rules_percent_nonnegative", sql`percent_value >= (0)::numeric`),
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
    uploaded_at: timestamp({ mode: "string" }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.loan_id],
      foreignColumns: [loan_records.loan_id],
      name: "loan_docs_loan_id_fkey",
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
    uploaded_at: timestamp({ mode: "string" }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.borrower_id],
      foreignColumns: [borrower_info.user_id],
      name: "borrower_docs_borrower_id_fkey",
    }),
  ],
);
