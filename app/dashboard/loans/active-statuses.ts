export const ACTIVE_LOAN_STATUSES = ["Active", "Overdue"] as const;

export function isActiveLoanStatus(status: string | null | undefined) {
  if (!status) return false;
  return ACTIVE_LOAN_STATUSES.includes(status as (typeof ACTIVE_LOAN_STATUSES)[number]);
}
