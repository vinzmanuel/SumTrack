export type StoredLoanStatus = "active" | "overdue" | "completed" | "archived" | "abandoned";
export type VisibleLoanStatus = "Active" | "Overdue" | "Completed" | "Archived" | "Abandoned";

export const LIVE_STORED_LOAN_STATUSES = ["active", "overdue"] as const satisfies readonly StoredLoanStatus[];
export const CLOSED_STORED_LOAN_STATUSES = ["completed", "archived"] as const satisfies readonly StoredLoanStatus[];
const TERMINAL_STORED_LOAN_STATUS_SET = new Set<StoredLoanStatus>(["archived", "abandoned"]);

function clampMoney(value: number) {
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}

export function getManilaTodayDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function normalizeStoredLoanStatus(status: string | null | undefined): StoredLoanStatus {
  if (!status) {
    return "active";
  }

  const normalized = status.trim().toLowerCase();

  if (normalized === "archived") {
    return "archived";
  }

  if (normalized === "abandoned") {
    return "abandoned";
  }

  if (normalized === "completed") {
    return "completed";
  }

  if (normalized === "overdue") {
    return "overdue";
  }

  return "active";
}

export function calculateLoanTotalPayable(principal: number, interest: number) {
  const safePrincipal = clampMoney(principal);
  const safeInterest = clampMoney(interest);
  return safePrincipal + (safePrincipal * safeInterest) / 100;
}

export function calculateLoanRemainingBalance(totalPayable: number, totalCollected: number) {
  return clampMoney(totalPayable - clampMoney(totalCollected));
}

export function isLoanPaidOff(remainingBalance: number) {
  return remainingBalance <= 0;
}

export function hasOutstandingLoanBalance(remainingBalance: number) {
  return remainingBalance > 0;
}

export function isTerminalStoredLoanStatus(status: string | null | undefined) {
  return TERMINAL_STORED_LOAN_STATUS_SET.has(normalizeStoredLoanStatus(status));
}

export function resolveReconciledStoredLoanStatus(params: {
  storedStatus: string | null | undefined;
  dueDate: string;
  remainingBalance: number;
  currentDate?: string;
}): StoredLoanStatus {
  const normalizedStoredStatus = normalizeStoredLoanStatus(params.storedStatus);

  if (isTerminalStoredLoanStatus(normalizedStoredStatus)) {
    return normalizedStoredStatus;
  }

  if (isLoanPaidOff(params.remainingBalance)) {
    return "completed";
  }

  const currentDate = params.currentDate ?? getManilaTodayDateString();
  if (currentDate > params.dueDate && hasOutstandingLoanBalance(params.remainingBalance)) {
    return "overdue";
  }

  return "active";
}

function toVisibleLoanStatus(status: StoredLoanStatus): VisibleLoanStatus {
  if (status === "archived") {
    return "Archived";
  }

  if (status === "abandoned") {
    return "Abandoned";
  }

  if (status === "completed") {
    return "Completed";
  }

  if (status === "overdue") {
    return "Overdue";
  }

  return "Active";
}

export function getVisibleLoanStatusFromStoredStatus(
  status: string | null | undefined,
): VisibleLoanStatus {
  return toVisibleLoanStatus(normalizeStoredLoanStatus(status));
}

export function resolveVisibleLoanStatus(params: {
  storedStatus: string | null | undefined;
  dueDate: string;
  remainingBalance: number;
  currentDate?: string;
}): VisibleLoanStatus {
  return toVisibleLoanStatus(
    resolveReconciledStoredLoanStatus({
      storedStatus: params.storedStatus,
      dueDate: params.dueDate,
      remainingBalance: params.remainingBalance,
      currentDate: params.currentDate,
    }),
  );
}

export function buildLoanComputedState(params: {
  principal: number;
  interest: number;
  totalCollected: number;
  dueDate: string;
  storedStatus: string | null | undefined;
  currentDate?: string;
}) {
  const totalPayable = calculateLoanTotalPayable(params.principal, params.interest);
  const totalCollected = clampMoney(params.totalCollected);
  const remainingBalance = calculateLoanRemainingBalance(totalPayable, totalCollected);
  const visibleStatus = resolveVisibleLoanStatus({
    storedStatus: params.storedStatus,
    dueDate: params.dueDate,
    remainingBalance,
    currentDate: params.currentDate,
  });

  return {
    storedStatus: normalizeStoredLoanStatus(params.storedStatus),
    visibleStatus,
    totalPayable,
    totalCollected,
    remainingBalance,
  };
}

export function isLoanInArchivedBucket(storedStatus: string | null | undefined) {
  return isTerminalStoredLoanStatus(storedStatus);
}

export function canRecordCollectionForLoan(params: {
  storedStatus: string | null | undefined;
  remainingBalance: number;
}) {
  if (isTerminalStoredLoanStatus(params.storedStatus)) {
    return false;
  }

  return hasOutstandingLoanBalance(params.remainingBalance);
}

export function resolveArchiveTargetStatus(params: {
  storedStatus: string | null | undefined;
  visibleStatus: VisibleLoanStatus;
}): StoredLoanStatus | null {
  const normalizedStoredStatus = normalizeStoredLoanStatus(params.storedStatus);

  if (normalizedStoredStatus === "archived" || normalizedStoredStatus === "abandoned") {
    return null;
  }

  if (params.visibleStatus === "Completed") {
    return "archived";
  }

  if (params.visibleStatus === "Overdue") {
    return "abandoned";
  }

  return null;
}
