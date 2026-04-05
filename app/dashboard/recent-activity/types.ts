export const RECENT_ACTIVITY_PAGE_SIZE = 20;

export const RECENT_ACTIVITY_TYPE_OPTIONS = [
  { value: "all", label: "All activity" },
  { value: "account_created", label: "Account created" },
  { value: "borrower_created", label: "Borrower created" },
  { value: "loan_created", label: "Loan created" },
  { value: "collection_recorded", label: "Collection recorded" },
  { value: "missed_payment_recorded", label: "Missed payment recorded" },
  { value: "expense_recorded", label: "Expense recorded" },
  { value: "incentive_rule_created", label: "Incentive rule created" },
  { value: "report_generated", label: "Report generated" },
  { value: "loan_document_uploaded", label: "Loan document uploaded" },
  { value: "borrower_document_uploaded", label: "Borrower document uploaded" },
] as const;

export const RECENT_ACTIVITY_PRESET_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Past 7 days" },
  { value: "30d", label: "Past 30 days" },
  { value: "180d", label: "Past 6 months" },
  { value: "lifetime", label: "Lifetime" },
  { value: "custom", label: "Custom range" },
] as const;

export type RecentActivityType =
  Exclude<(typeof RECENT_ACTIVITY_TYPE_OPTIONS)[number]["value"], "all">;

export type RecentActivityTypeFilter = (typeof RECENT_ACTIVITY_TYPE_OPTIONS)[number]["value"];
export type RecentActivityPreset = (typeof RECENT_ACTIVITY_PRESET_OPTIONS)[number]["value"];

export type RecentActivityFilters = {
  preset: RecentActivityPreset;
  fromDate: string | null;
  toDate: string | null;
  activityType: RecentActivityTypeFilter;
  actorRoleName: string | null;
  actorUserId: string | null;
  branchId: number | null;
  page: number;
};

export type RecentActivityItem = {
  activityId: string;
  activityType: RecentActivityType;
  activityLabel: string;
  actorUserId: string | null;
  actorName: string;
  actorRoleName: string | null;
  subjectPrimary: string;
  contextLabel: string | null;
  detailPrimary: string | null;
  detailSecondary: string | null;
  detailTertiary: string | null;
  branchLabel: string | null;
  occurredAt: string;
};

export type RecentActivityActorOption = {
  userId: string;
  displayName: string;
  roleName: string | null;
};

export type RecentActivityBranchOption = {
  branchId: number;
  branchName: string;
};

export type RecentActivityPageData = {
  items: RecentActivityItem[];
  actorOptions: RecentActivityActorOption[];
  branchOptions: RecentActivityBranchOption[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  scopeLabel: string;
  rangeLabel: string;
};
