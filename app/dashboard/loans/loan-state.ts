export type StoredLoanStatus = "active" | "archived" | "abandoned";
export type VisibleLoanStatus = "Active" | "Overdue" | "Completed" | "Archived" | "Abandoned";

const ARCHIVED_STORED_VALUES = new Set(["archived", "Archived"]);
const ABANDONED_STORED_VALUES = new Set(["abandoned", "Abandoned"]);

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

  if (ARCHIVED_STORED_VALUES.has(status)) {
    return "archived";
  }

  if (ABANDONED_STORED_VALUES.has(status)) {
    return "abandoned";
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

export function resolveVisibleLoanStatus(params: {
  storedStatus: string | null | undefined;
  dueDate: string;
  remainingBalance: number;
  currentDate?: string;
}): VisibleLoanStatus {
  const normalizedStoredStatus = normalizeStoredLoanStatus(params.storedStatus);

  if (normalizedStoredStatus === "archived") {
    return "Archived";
  }

  if (normalizedStoredStatus === "abandoned") {
    return "Abandoned";
  }

  if (params.remainingBalance <= 0) {
    return "Completed";
  }

  const currentDate = params.currentDate ?? getManilaTodayDateString();
  if (currentDate > params.dueDate && params.remainingBalance > 0) {
    return "Overdue";
  }

  return "Active";
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
  const normalizedStoredStatus = normalizeStoredLoanStatus(storedStatus);
  return normalizedStoredStatus === "archived" || normalizedStoredStatus === "abandoned";
}

export function canRecordCollectionForLoan(params: {
  storedStatus: string | null | undefined;
  remainingBalance: number;
}) {
  const normalizedStoredStatus = normalizeStoredLoanStatus(params.storedStatus);

  if (normalizedStoredStatus === "archived" || normalizedStoredStatus === "abandoned") {
    return false;
  }

  return params.remainingBalance > 0;
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
