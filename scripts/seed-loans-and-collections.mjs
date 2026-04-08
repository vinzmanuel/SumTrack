import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });

const SEED_WINDOW_START = "2025-08-01";
const CURRENT_DATE = "2026-04-09";
const ACTIVE_TARGET = 27;
const OVERDUE_TARGET = 2;
const ABANDONED_TARGET = 1;
const MISSED_PAYMENT_TARGET = 11;
const FIXED_HOLIDAYS = new Set(["01-01", "11-02", "12-25"]);
const MISSED_PAYMENT_NOTES = [
  "Borrower not present during collection.",
  "Did not answer phone; follow-up tomorrow.",
  "Requested follow-up tomorrow after market hours.",
  "Temporarily away for family errand.",
  "Requested another visit on the next round.",
  "No one at home during collection round.",
  "Collector advised return visit in the morning.",
  "Borrower attending family errand; to follow up next day.",
  "Requested one-day extension due to school expense.",
  "Client was at work; requested evening follow-up.",
  "Left reminder with household member for next visit.",
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function fraction(value) {
  return (hashString(value) % 10000) / 10000;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parseIsoDateParts(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return { year, month, day };
}

function parseIsoDate(value) {
  const parts = parseIsoDateParts(value);
  if (!parts) {
    return null;
  }

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(value) {
  return value.toISOString().slice(0, 10);
}

function addUtcDays(value, amount) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function calculateEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function calculateGoodFridayIsoDate(year) {
  return toIsoDate(addUtcDays(calculateEasterSunday(year), -2));
}

function isNonCollectionHoliday(dateString) {
  const parts = parseIsoDateParts(dateString);
  if (!parts) {
    return false;
  }

  const monthDay = `${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  if (FIXED_HOLIDAYS.has(monthDay)) {
    return true;
  }

  return dateString === calculateGoodFridayIsoDate(parts.year);
}

function isValidScheduledCollectionDate(dateString) {
  const date = parseIsoDate(dateString);
  if (!date) {
    return false;
  }

  if (date.getUTCDay() === 0) {
    return false;
  }

  return !isNonCollectionHoliday(dateString);
}

function generateScheduledCollectionDates({ startDate, obligationCount }) {
  const start = parseIsoDate(startDate);
  if (!start || !Number.isFinite(obligationCount) || obligationCount <= 0) {
    return [];
  }

  const dates = [];
  const cursor = new Date(start);

  while (dates.length < obligationCount) {
    const currentIsoDate = toIsoDate(cursor);
    if (isValidScheduledCollectionDate(currentIsoDate)) {
      dates.push(currentIsoDate);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function previousValidCollectionDate(dateString) {
  const start = parseIsoDate(dateString);
  if (!start) {
    return null;
  }

  const cursor = new Date(start);
  while (true) {
    const isoDate = toIsoDate(cursor);
    if (isValidScheduledCollectionDate(isoDate)) {
      return isoDate;
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
}

function calculateScheduledStartDateFromDueDate({ dueDate, obligationCount }) {
  const end = parseIsoDate(dueDate);
  if (!end || !Number.isFinite(obligationCount) || obligationCount <= 0) {
    return null;
  }

  const dates = [];
  const cursor = new Date(end);
  while (dates.length < obligationCount) {
    const isoDate = toIsoDate(cursor);
    if (isValidScheduledCollectionDate(isoDate)) {
      dates.push(isoDate);
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return dates.length > 0 ? dates[dates.length - 1] : null;
}

function toMoneyCents(value) {
  return Math.round(Number(value) * 100);
}

function fromMoneyCents(value) {
  return value / 100;
}

function roundToStepCents(value, stepCents) {
  if (!Number.isFinite(value) || !Number.isFinite(stepCents) || stepCents <= 0) {
    return 0;
  }
  return Math.max(0, Math.round(value / stepCents) * stepCents);
}

function getUtcWeekday(dateString) {
  const date = parseIsoDate(dateString);
  return date ? date.getUTCDay() : null;
}

function calculateLoanTotalPayable(principal, interest) {
  return fromMoneyCents(Math.round((principal + (principal * interest) / 100) * 100));
}

function calculateRemainingBalance(totalPayable, totalCollected) {
  return fromMoneyCents(Math.max(toMoneyCents(totalPayable) - toMoneyCents(totalCollected), 0));
}

function resolveStatus({ storedStatus, dueDate, totalPayable, totalCollected }) {
  if (storedStatus === "abandoned") {
    return "abandoned";
  }

  const remainingBalance = calculateRemainingBalance(totalPayable, totalCollected);
  if (remainingBalance <= 0) {
    return "completed";
  }
  if (CURRENT_DATE > dueDate) {
    return "overdue";
  }
  return "active";
}

function buildBranchProfile(branchName) {
  const normalized = String(branchName).trim().toLowerCase();

  if (normalized.includes("tagbilaran")) {
    return { activity: "busy", activeWeight: 1.55, repeatBias: 1.15, key: "tagbilaran" };
  }
  if (normalized.includes("cebu city")) {
    return { activity: "busy", activeWeight: 1.65, repeatBias: 1.18, key: "cebu-city" };
  }
  if (normalized.includes("ubay")) {
    return { activity: "mid", activeWeight: 0.92, repeatBias: 0.94, key: "ubay" };
  }
  if (normalized.includes("tubigon")) {
    return { activity: "mid", activeWeight: 0.9, repeatBias: 0.91, key: "tubigon" };
  }
  if (normalized.includes("mandaue")) {
    return { activity: "mid", activeWeight: 0.93, repeatBias: 0.96, key: "mandaue" };
  }

  return { activity: "mid", activeWeight: 1, repeatBias: 1, key: normalized };
}

function assignCollectorPerformance(branchAreas) {
  const sorted = [...branchAreas].sort((left, right) => left.area_code.localeCompare(right.area_code));
  return sorted.map((item, index) => {
    if (index === 0) {
      return { ...item, performance: "strong" };
    }
    if (index <= 2) {
      return { ...item, performance: "above_average" };
    }
    return { ...item, performance: "average" };
  });
}

function buildLoanCode(companyId, sequence) {
  return `${companyId}-L${String(sequence).padStart(3, "0")}`;
}

function buildCollectionCode(loanCode, sequence) {
  return `${loanCode}-C${String(sequence).padStart(3, "0")}`;
}

function chooseTermDays(key) {
  return fraction(`${key}:term`) < 0.54 ? 58 : 60;
}

function chooseGapDays(key) {
  const gapBehavior = fraction(`${key}:gap-behavior`);
  if (gapBehavior < 0.4) {
    return 1 + (hashString(`${key}:gap-fast`) % 2);
  }
  return 7 + (hashString(`${key}:gap-slow`) % 8);
}

function chooseCompletedLoanCount(borrower) {
  const score = fraction(`${borrower.company_id}:count`);
  const profile = borrower.branchProfile.activity;
  const performance = borrower.collectorPerformance;

  const thresholds = {
    busy: {
      strong: { second: 0.48, third: 0.13, fourth: 0.03 },
      above_average: { second: 0.42, third: 0.1, fourth: 0.02 },
      average: { second: 0.36, third: 0.07, fourth: 0.012 },
    },
    mid: {
      strong: { second: 0.32, third: 0.08, fourth: 0.018 },
      above_average: { second: 0.28, third: 0.06, fourth: 0.012 },
      average: { second: 0.24, third: 0.04, fourth: 0.008 },
    },
  };

  const branchThresholds = thresholds[profile][performance];
  let count = 1;
  if (score < branchThresholds.second) {
    count += 1;
  }
  if (score < branchThresholds.third) {
    count += 1;
  }
  if (score < branchThresholds.fourth) {
    count += 1;
  }

  return count;
}

function chooseAmountAndInterest({ borrower, loanIndex, finalStatus, hadCleanRepeatHistory }) {
  const score = fraction(`${borrower.company_id}:loan:${loanIndex}`);
  const qualityBase = fraction(`${borrower.company_id}:quality`);
  let quality = qualityBase;

  if (borrower.collectorPerformance === "strong") {
    quality += 0.12;
  } else if (borrower.collectorPerformance === "above_average") {
    quality += 0.05;
  }

  if (hadCleanRepeatHistory) {
    quality += 0.12;
  }

  if (finalStatus === "overdue" || finalStatus === "abandoned") {
    quality -= 0.08;
  }

  quality = clamp(quality, 0, 1);

  let principal;
  if (finalStatus === "abandoned") {
    principal = 10500 + (hashString(`${borrower.company_id}:abandoned-principal`) % 5) * 500;
  } else if (quality > 0.82 && loanIndex >= 1 && score < 0.34) {
    principal = 15000 + (hashString(`${borrower.company_id}:large:${loanIndex}`) % 11) * 500;
  } else if (quality > 0.52) {
    principal = 8000 + (hashString(`${borrower.company_id}:mid:${loanIndex}`) % 15) * 500;
  } else {
    principal = 5000 + (hashString(`${borrower.company_id}:small:${loanIndex}`) % 13) * 500;
  }

  principal = clamp(principal, 5000, 20000);

  let interestMin;
  let interestMax;
  if (principal <= 7500) {
    interestMin = 12;
    interestMax = 15;
    if (quality > 0.88 && score < 0.2) {
      interestMin = 11;
    }
  } else if (principal <= 11500) {
    interestMin = 10;
    interestMax = 12;
    if (principal >= 10500 && quality > 0.84 && score < 0.24) {
      interestMin = 9;
    } else if (principal <= 8500 && quality < 0.28 && score > 0.76) {
      interestMax = 13;
    }
  } else if (principal <= 15000) {
    interestMin = 8;
    interestMax = 10;
    if (principal >= 14000 && quality > 0.86 && score < 0.2) {
      interestMin = 7;
    } else if (principal <= 12500 && quality < 0.3 && score > 0.72) {
      interestMax = 11;
    }
  } else {
    interestMin = 6;
    interestMax = 8;
  }

  let riskPosition = 1 - quality;
  riskPosition += (score - 0.5) * 0.35;
  if (borrower.branchProfile.activity === "busy") {
    riskPosition += 0.03;
  }
  if (hadCleanRepeatHistory) {
    riskPosition -= 0.06;
  }
  if (finalStatus === "overdue" || finalStatus === "abandoned") {
    riskPosition += 0.14;
  }

  riskPosition = clamp(riskPosition, 0, 1);
  const interest = interestMin + Math.round(riskPosition * (interestMax - interestMin));

  return {
    principal,
    interest: clamp(interest, 6, 15),
  };
}

function pickCompletedDueDate(borrower, totalLoans) {
  const spanDays = 166;
  const offset = hashString(`${borrower.company_id}:completed-due:${totalLoans}`) % spanDays;
  const baseDate = addUtcDays(parseIsoDate("2025-10-15"), offset);
  return previousValidCollectionDate(toIsoDate(baseDate));
}

function pickActiveDueDate(borrower, quotaIndex) {
  const offset = (hashString(`${borrower.company_id}:active:${quotaIndex}`) % 56) + 5;
  const baseDate = addUtcDays(parseIsoDate(CURRENT_DATE), offset);
  return previousValidCollectionDate(toIsoDate(baseDate));
}

function pickOverdueDueDate(borrower, slotIndex) {
  const offset = 4 + (hashString(`${borrower.company_id}:overdue:${slotIndex}`) % 12);
  const baseDate = addUtcDays(parseIsoDate("2026-03-22"), offset);
  return previousValidCollectionDate(toIsoDate(baseDate));
}

function pickAbandonedDueDate(borrower) {
  const offset = hashString(`${borrower.company_id}:abandoned-due`) % 18;
  const baseDate = addUtcDays(parseIsoDate("2025-12-10"), offset);
  return previousValidCollectionDate(toIsoDate(baseDate));
}

function chooseFinalDueDate({ borrower, finalStatus, totalLoans, quotaIndex }) {
  if (finalStatus === "active") {
    return pickActiveDueDate(borrower, quotaIndex);
  }
  if (finalStatus === "overdue") {
    return pickOverdueDueDate(borrower, quotaIndex);
  }
  if (finalStatus === "abandoned") {
    return pickAbandonedDueDate(borrower);
  }
  return pickCompletedDueDate(borrower, totalLoans);
}

function chooseCreatorUserId(borrower, loanIndex) {
  const branchOps = borrower.branchOps;
  if (branchOps.secretaries.length > 0 && fraction(`${borrower.company_id}:creator:${loanIndex}`) < 0.86) {
    return branchOps.secretaries[hashString(`${borrower.company_id}:creator-secretary:${loanIndex}`) % branchOps.secretaries.length].user_id;
  }
  if (branchOps.managers.length > 0) {
    return branchOps.managers[hashString(`${borrower.company_id}:creator-manager:${loanIndex}`) % branchOps.managers.length].user_id;
  }
  if (branchOps.secretaries.length > 0) {
    return branchOps.secretaries[0].user_id;
  }
  throw new Error(`No secretary or branch manager available in ${borrower.branch_name} for loan creation.`);
}

function chooseEncoderUserId(borrower, loanIndex) {
  const branchOps = borrower.branchOps;
  if (branchOps.secretaries.length > 0) {
    return branchOps.secretaries[hashString(`${borrower.company_id}:encoder:${loanIndex}`) % branchOps.secretaries.length].user_id;
  }
  if (branchOps.managers.length > 0) {
    return branchOps.managers[0].user_id;
  }
  throw new Error(`No secretary or branch manager available in ${borrower.branch_name} for collection encoding.`);
}

function allocateCountsByWeight(items, total, weightFn) {
  const weighted = items.map((item) => ({
    item,
    raw: weightFn(item),
  }));
  const totalWeight = weighted.reduce((sum, row) => sum + row.raw, 0);
  const provisional = weighted.map((row) => {
    const exact = totalWeight > 0 ? (row.raw / totalWeight) * total : 0;
    return {
      item: row.item,
      base: Math.floor(exact),
      remainder: exact - Math.floor(exact),
    };
  });

  let assigned = provisional.reduce((sum, row) => sum + row.base, 0);
  provisional.sort((left, right) => right.remainder - left.remainder);
  for (let index = 0; assigned < total && index < provisional.length; index += 1) {
    provisional[index].base += 1;
    assigned += 1;
  }

  return new Map(provisional.map((row) => [row.item.branch_id, row.base]));
}

function chooseActiveBorrowers(branchBorrowers, quota) {
  return [...branchBorrowers]
    .sort((left, right) => {
      const leftScore =
        fraction(`${left.company_id}:active`) +
        (left.collectorPerformance === "average" ? 0.15 : left.collectorPerformance === "above_average" ? 0.05 : -0.05);
      const rightScore =
        fraction(`${right.company_id}:active`) +
        (right.collectorPerformance === "average" ? 0.15 : right.collectorPerformance === "above_average" ? 0.05 : -0.05);
      return rightScore - leftScore;
    })
    .slice(0, quota);
}

function chooseOverdueBorrower(branchBorrowers) {
  return [...branchBorrowers].sort((left, right) => {
    const leftScore =
      fraction(`${left.company_id}:overdue`) +
      (left.collectorPerformance === "average" ? 0.18 : left.collectorPerformance === "above_average" ? 0.08 : -0.1);
    const rightScore =
      fraction(`${right.company_id}:overdue`) +
      (right.collectorPerformance === "average" ? 0.18 : right.collectorPerformance === "above_average" ? 0.08 : -0.1);
    return rightScore - leftScore;
  })[0] ?? null;
}

function chooseAbandonedBorrower(branchBorrowers) {
  return [...branchBorrowers].sort((left, right) => {
    const leftScore =
      fraction(`${left.company_id}:abandoned`) +
      (left.collectorPerformance === "average" ? 0.22 : left.collectorPerformance === "above_average" ? 0.04 : -0.15);
    const rightScore =
      fraction(`${right.company_id}:abandoned`) +
      (right.collectorPerformance === "average" ? 0.22 : right.collectorPerformance === "above_average" ? 0.04 : -0.15);
    return rightScore - leftScore;
  })[0] ?? null;
}

function createLoanTimeline({ borrower, totalLoans, finalStatus, quotaIndex }) {
  for (let plannedCount = totalLoans; plannedCount >= 1; plannedCount -= 1) {
    const loans = [];
    let nextLoan = null;
    let success = true;

    for (let index = plannedCount - 1; index >= 0; index -= 1) {
      const loanStatus = index === plannedCount - 1 ? finalStatus : "completed";
      const loanKey = `${borrower.company_id}:${index + 1}:${loanStatus}`;
      const termDays = chooseTermDays(loanKey);
      const dueDate =
        index === plannedCount - 1
          ? chooseFinalDueDate({ borrower, finalStatus: loanStatus, totalLoans: plannedCount, quotaIndex })
          : previousValidCollectionDate(
              toIsoDate(
                addUtcDays(parseIsoDate(nextLoan.startDate), -chooseGapDays(`${borrower.company_id}:${index}:gap`)),
              ),
            );
      const startDate = calculateScheduledStartDateFromDueDate({
        dueDate,
        obligationCount: termDays,
      });

      if (!startDate || startDate < SEED_WINDOW_START) {
        success = false;
        break;
      }

      const hadCleanRepeatHistory = index > 0;
      const { principal, interest } = chooseAmountAndInterest({
        borrower,
        loanIndex: index,
        finalStatus: loanStatus,
        hadCleanRepeatHistory,
      });
      const loanCode = buildLoanCode(borrower.company_id, index + 1);
      const createdBy = chooseCreatorUserId(borrower, index);
      const encodedBy = chooseEncoderUserId(borrower, index);
      const totalPayable = calculateLoanTotalPayable(principal, interest);

      loans.push({
        loanCode,
        borrowerId: borrower.user_id,
        borrowerCompanyId: borrower.company_id,
        borrowerBranchId: borrower.branch_id,
        borrowerBranchName: borrower.branch_name,
        borrowerAreaId: borrower.area_id,
        borrowerAreaCode: borrower.area_code,
        collectorId: borrower.collector_user_id,
        collectorPerformance: borrower.collectorPerformance,
        createdBy,
        encodedBy,
        principal,
        interest,
        termDays,
        startDate,
        dueDate,
        status: loanStatus,
        totalPayable,
        branchProfile: borrower.branchProfile,
        branchName: borrower.branch_name,
        sequence: index + 1,
        createdAt: `${startDate}T09:${String((hashString(`${loanCode}:created-minute`) % 40) + 10).padStart(2, "0")}:00.000Z`,
      });

      nextLoan = { startDate, dueDate };
    }

    if (success) {
      return loans.reverse();
    }
  }

  throw new Error(`Unable to fit the planned loan history for ${borrower.company_id} inside the seed window.`);
}

function chooseTargetCollectedCents(loan, recordDates) {
  const totalCents = toMoneyCents(loan.totalPayable);
  const expectedDailyDueCents = Math.round(totalCents / loan.termDays);
  if (loan.status === "completed") {
    return totalCents;
  }

  if (loan.status === "abandoned") {
    const anchoredDays = Math.max(3, recordDates.length - 1);
    const anchoredFactor = 0.82 + (hashString(`${loan.loanCode}:abandoned-anchor`) % 22) / 100;
    const anchoredRecovery = expectedDailyDueCents * anchoredDays * anchoredFactor;
    const cappedRecovery = totalCents * (0.16 + (hashString(`${loan.loanCode}:abandoned-cap`) % 5) / 100);
    return roundToStepCents(Math.min(cappedRecovery, anchoredRecovery), 500);
  }

  if (loan.status === "overdue") {
    const ratio = 0.72 + (hashString(`${loan.loanCode}:overdue-ratio`) % 9) / 100;
    return roundToStepCents(Math.max(1, Math.round(totalCents * ratio)), 500);
  }

  const elapsedRatio = recordDates.length / loan.termDays;
  let healthFactor = 0.96;
  if (loan.collectorPerformance === "strong") {
    healthFactor = 1.01;
  } else if (loan.collectorPerformance === "above_average") {
    healthFactor = 0.985;
  }

  const target = Math.round(totalCents * clamp(elapsedRatio * healthFactor, 0.35, 0.9));
  return roundToStepCents(clamp(target, Math.round(totalCents * 0.35), totalCents - 500), 500);
}

function buildCollectionBehaviorProfile(loan) {
  if (loan.status === "abandoned") {
    return { low: 0.72, high: 1.08, mondayChance: 0.35, mondayBoostLow: 0.18, mondayBoostHigh: 0.42 };
  }
  if (loan.status === "overdue") {
    return { low: 0.74, high: 1.2, mondayChance: 0.68, mondayBoostLow: 0.35, mondayBoostHigh: 0.85 };
  }
  if (loan.collectorPerformance === "strong") {
    return { low: 0.9, high: 1.08, mondayChance: 0.62, mondayBoostLow: 0.28, mondayBoostHigh: 0.72 };
  }
  if (loan.collectorPerformance === "above_average") {
    return { low: 0.84, high: 1.16, mondayChance: 0.66, mondayBoostLow: 0.34, mondayBoostHigh: 0.82 };
  }
  return { low: 0.76, high: 1.24, mondayChance: 0.7, mondayBoostLow: 0.4, mondayBoostHigh: 0.92 };
}

function chooseRoundedPaymentStepCents({ loan, dateKey, isMonday, isCatchupDay, roughCents }) {
  if (loan.status === "abandoned") {
    return 500;
  }

  const dueStepBias = roughCents >= 35000 ? 0.58 : 0.76;
  if ((isMonday && fraction(`${dateKey}:step`) > 1 - dueStepBias) || (isCatchupDay && roughCents >= 30000)) {
    return 1000;
  }

  if (fraction(`${dateKey}:step-10`) > 0.84) {
    return 1000;
  }

  return 500;
}

function rebalanceRoundedAmounts({
  amountsInCents,
  targetCollectedCents,
  expectedDailyDueCents,
  loan,
  recordDates,
  zeroIndexes,
  catchupIndexes,
}) {
  let difference = targetCollectedCents - amountsInCents.reduce((sum, value) => sum + value, 0);
  const step = 500;
  if (difference === 0) {
    return amountsInCents;
  }

  const candidates = recordDates
    .map((date, index) => ({
      index,
      isMonday: getUtcWeekday(date) === 1,
      isCatchupDay: catchupIndexes.has(index),
      cap:
        loan.status === "abandoned"
          ? roundToStepCents(expectedDailyDueCents * 1.7, 500)
          : roundToStepCents(
              expectedDailyDueCents * (getUtcWeekday(date) === 1 ? 2.5 : catchupIndexes.has(index) ? 2.15 : 1.7),
              500,
            ),
      floor:
        zeroIndexes.has(index)
          ? 0
          : roundToStepCents(
              expectedDailyDueCents *
                (loan.status === "abandoned"
                  ? 0.5
                  : loan.status === "overdue"
                    ? 0.35
                    : loan.collectorPerformance === "strong"
                      ? 0.62
                      : 0.45),
              500,
            ),
    }))
    .filter((entry) => !zeroIndexes.has(entry.index));

  const prioritized = [...candidates].sort((left, right) => {
    const leftScore = (left.isCatchupDay ? 4 : 0) + (left.isMonday ? 2 : 0);
    const rightScore = (right.isCatchupDay ? 4 : 0) + (right.isMonday ? 2 : 0);
    return rightScore - leftScore;
  });
  const reversePrioritized = [...prioritized].reverse();

  let guard = 0;
  while (difference !== 0 && guard < 20000) {
    const increase = difference > 0;
    const queue = increase ? prioritized : reversePrioritized;
    let changed = false;

    for (const entry of queue) {
      if (increase) {
        if (amountsInCents[entry.index] + step <= entry.cap) {
          amountsInCents[entry.index] += step;
          difference -= step;
          changed = true;
          break;
        }
      } else if (amountsInCents[entry.index] - step >= entry.floor) {
        amountsInCents[entry.index] -= step;
        difference += step;
        changed = true;
        break;
      }
    }

    if (!changed) {
      throw new Error(`Unable to rebalance rounded collection amounts for ${loan.loanCode}.`);
    }

    guard += 1;
  }

  if (difference !== 0) {
    const absorberQueue =
      difference > 0
        ? prioritized
        : reversePrioritized;

    const absorber = absorberQueue.find((entry) => {
      if (difference > 0) {
        return amountsInCents[entry.index] + difference <= entry.cap + 1500;
      }
      return amountsInCents[entry.index] + difference >= Math.max(0, entry.floor - 1500);
    });

    if (!absorber) {
      throw new Error(`Unable to absorb final rounded remainder for ${loan.loanCode}.`);
    }

    amountsInCents[absorber.index] += difference;
    difference = 0;
  }

  const finalTotal = amountsInCents.reduce((sum, value) => sum + value, 0);
  if (finalTotal !== targetCollectedCents) {
    throw new Error(`Rounded collection totals still mismatch for ${loan.loanCode}.`);
  }

  return amountsInCents;
}

function buildCollectionRowsForLoan(loan, shouldMiss, noteIndex) {
  const scheduleDates = generateScheduledCollectionDates({
    startDate: loan.startDate,
    obligationCount: loan.termDays,
  });

  let recordDates;
  if (loan.status === "active") {
    recordDates = scheduleDates.filter((date) => date <= CURRENT_DATE);
  } else if (loan.status === "abandoned") {
    recordDates = scheduleDates.slice(0, 6 + (hashString(`${loan.loanCode}:abandoned-records`) % 4));
  } else {
    recordDates = scheduleDates;
  }

  if (recordDates.length === 0) {
    throw new Error(`Loan ${loan.loanCode} has no recordable collection dates.`);
  }

  const zeroIndexes = new Set();
  const catchupIndexes = new Set();
  let missedIndex = null;

  if (shouldMiss) {
    const latestMissIndex =
      loan.status === "abandoned" ? Math.max(1, recordDates.length - 2) : Math.max(1, recordDates.length - 3);
    missedIndex = Math.min(
      latestMissIndex,
      Math.max(1, Math.floor(recordDates.length * (loan.status === "abandoned" ? 0.3 : 0.48))),
    );
    zeroIndexes.add(missedIndex);

    if (loan.status !== "abandoned") {
      const firstCatchupIndex = Math.min(recordDates.length - 1, missedIndex + 1);
      catchupIndexes.add(firstCatchupIndex);
      if (firstCatchupIndex + 1 < recordDates.length) {
        catchupIndexes.add(firstCatchupIndex + 1);
      }
    }
  }

  const targetCollectedCents = chooseTargetCollectedCents(loan, recordDates);
  const expectedDailyDueCents = Math.round(toMoneyCents(loan.totalPayable) / loan.termDays);
  const behavior = buildCollectionBehaviorProfile(loan);
  const rawAmountsInCents = recordDates.map((collectionDate, index) => {
    if (zeroIndexes.has(index)) {
      return 0;
    }

    const dayKey = `${loan.loanCode}:${collectionDate}:${index}`;
    const weekday = getUtcWeekday(collectionDate);
    const isMonday = weekday === 1;
    const isSaturday = weekday === 6;
    const isCatchupDay = catchupIndexes.has(index);
    const spread = behavior.high - behavior.low;
    let multiplier = behavior.low + fraction(`${dayKey}:variance`) * spread;

    if (loan.branchProfile.activity === "busy") {
      multiplier += 0.03;
    }

    if (isSaturday && loan.status !== "abandoned" && fraction(`${dayKey}:saturday-light`) < 0.46) {
      multiplier -= 0.08 + fraction(`${dayKey}:saturday-light-amt`) * 0.08;
    }

    if (isMonday && fraction(`${dayKey}:monday-heavy`) < behavior.mondayChance) {
      multiplier +=
        behavior.mondayBoostLow +
        fraction(`${dayKey}:monday-boost`) * (behavior.mondayBoostHigh - behavior.mondayBoostLow);
    }

    if (isCatchupDay) {
      multiplier += 0.24 + fraction(`${dayKey}:catchup`) * 0.38;
    }

    if (loan.status === "abandoned") {
      multiplier = Math.min(multiplier, isMonday ? 1.45 : 1.18);
    } else if (loan.status === "overdue") {
      multiplier = Math.min(multiplier, isMonday ? 2.1 : 1.7);
    } else {
      multiplier = Math.min(multiplier, isMonday ? 2.15 : 1.55);
    }

    multiplier = Math.max(multiplier, loan.status === "abandoned" ? 0.62 : 0.45);

    const roughCents = expectedDailyDueCents * multiplier;
    const step = chooseRoundedPaymentStepCents({
      loan,
      dateKey: dayKey,
      isMonday,
      isCatchupDay,
      roughCents,
    });

    return Math.max(step, roundToStepCents(roughCents, step));
  });

  const rawTotal = rawAmountsInCents.reduce((sum, value) => sum + value, 0);
  const scaleFactor = rawTotal > 0 ? targetCollectedCents / rawTotal : 1;
  let amountsInCents = rawAmountsInCents.map((amountCents, index) => {
    if (amountCents <= 0) {
      return 0;
    }

    const collectionDate = recordDates[index];
    const dayKey = `${loan.loanCode}:${collectionDate}:${index}:scaled`;
    const scaledAmount = amountCents * scaleFactor;
    const step = chooseRoundedPaymentStepCents({
      loan,
      dateKey: dayKey,
      isMonday: getUtcWeekday(collectionDate) === 1,
      isCatchupDay: catchupIndexes.has(index),
      roughCents: scaledAmount,
    });

    return Math.max(step, roundToStepCents(scaledAmount, step));
  });

  amountsInCents = rebalanceRoundedAmounts({
    amountsInCents,
    targetCollectedCents,
    expectedDailyDueCents,
    loan,
    recordDates,
    zeroIndexes,
    catchupIndexes,
  });

  const note = shouldMiss ? MISSED_PAYMENT_NOTES[noteIndex % MISSED_PAYMENT_NOTES.length] : null;
  let runningTotalCents = 0;

  const rows = recordDates.map((collectionDate, index) => {
    const amountCents = amountsInCents[index];
    runningTotalCents += amountCents;
    return {
      loanCode: loan.loanCode,
      collectionCode: buildCollectionCode(loan.loanCode, index + 1),
      amount: fromMoneyCents(amountCents).toFixed(2),
      note: shouldMiss && index === missedIndex ? note : null,
      collectionDate,
      collectorId: loan.collectorId,
      encodedBy: loan.encodedBy,
      createdAt: `${collectionDate}T16:${String((hashString(`${loan.loanCode}:${collectionDate}:created-minute`) % 45) + 10).padStart(2, "0")}:00.000Z`,
      isMissedPayment: shouldMiss && index === missedIndex,
    };
  });

  const totalCollected = fromMoneyCents(runningTotalCents);
  const resolvedStatus = resolveStatus({
    storedStatus: loan.status,
    dueDate: loan.dueDate,
    totalPayable: loan.totalPayable,
    totalCollected,
  });

  if (loan.status !== resolvedStatus) {
    throw new Error(`Seeded collections for ${loan.loanCode} resolve to ${resolvedStatus}, not ${loan.status}.`);
  }

  return {
    rows,
    totalCollected,
    missedCount: shouldMiss ? 1 : 0,
  };
}

function verifyNoOverlap(loansByBorrower) {
  for (const loanGroup of loansByBorrower.values()) {
    const sorted = [...loanGroup].sort((left, right) => left.startDate.localeCompare(right.startDate));
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      if (current.startDate <= previous.dueDate) {
        throw new Error(`Loan overlap detected for ${current.borrowerCompanyId}: ${previous.loanCode} vs ${current.loanCode}.`);
      }
    }
  }
}

function ensureAllCollectionDatesValid(collectionRows) {
  for (const row of collectionRows) {
    if (!isValidScheduledCollectionDate(row.collectionDate)) {
      throw new Error(`Collection ${row.collectionCode} falls on an invalid collection date (${row.collectionDate}).`);
    }
  }
}

function ensureUnique(values, label) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Duplicate ${label} detected: ${value}`);
    }
    seen.add(value);
  }
}

async function main() {
  const databaseUrl = requireEnv("DATABASE_URL");
  const sql = postgres(databaseUrl, { prepare: false });

  try {
    const [operationalCounts] = await sql`
      select
        (select count(*)::int from loan_records) as loan_count,
        (select count(*)::int from collections) as collection_count
    `;

    if ((operationalCounts?.loan_count ?? 0) > 0 || (operationalCounts?.collection_count ?? 0) > 0) {
      throw new Error(
        `Seed refused: loan_records=${operationalCounts.loan_count}, collections=${operationalCounts.collection_count}. This runner only seeds into a clean operational dataset.`,
      );
    }

    const borrowerRows = await sql`
      select
        u.user_id,
        u.company_id,
        bi.area_id,
        bi.first_name,
        bi.middle_name,
        bi.last_name,
        a.area_code,
        a.area_no,
        a.branch_id,
        b.branch_name
      from users u
      inner join roles r on r.role_id = u.role_id
      inner join borrower_info bi on bi.user_id = u.user_id
      inner join areas a on a.area_id = bi.area_id
      inner join branch b on b.branch_id = a.branch_id
      where r.role_name = 'Borrower'
        and u.status = 'active'
        and a.status = 'active'
        and b.status = 'active'
      order by b.branch_name asc, a.area_code asc, u.company_id asc
    `;

    const collectorRows = await sql`
      select
        eaa.assignment_id,
        eaa.start_date,
        eaa.area_id,
        a.area_code,
        a.area_no,
        a.branch_id,
        b.branch_name,
        u.user_id,
        u.company_id,
        ei.first_name,
        ei.last_name
      from employee_area_assignment eaa
      inner join users u on u.user_id = eaa.employee_user_id
      inner join roles r on r.role_id = u.role_id
      inner join employee_info ei on ei.user_id = u.user_id
      inner join areas a on a.area_id = eaa.area_id
      inner join branch b on b.branch_id = a.branch_id
      where r.role_name = 'Collector'
        and u.status = 'active'
        and eaa.end_date is null
        and a.status = 'active'
        and b.status = 'active'
      order by b.branch_name asc, a.area_code asc, eaa.start_date desc, eaa.assignment_id desc, u.company_id asc
    `;

    const opsRows = await sql`
      select
        eba.branch_id,
        b.branch_name,
        r.role_name,
        u.user_id,
        u.company_id,
        ei.first_name,
        ei.last_name
      from employee_branch_assignment eba
      inner join users u on u.user_id = eba.employee_user_id
      inner join roles r on r.role_id = u.role_id
      inner join employee_info ei on ei.user_id = u.user_id
      inner join branch b on b.branch_id = eba.branch_id
      where r.role_name in ('Secretary', 'Branch Manager')
        and u.status = 'active'
        and eba.end_date is null
        and b.status = 'active'
      order by b.branch_name asc, r.role_name asc, u.company_id asc
    `;

    if (borrowerRows.length === 0) {
      throw new Error("No active borrowers were found. Run borrower seeding first.");
    }
    if (collectorRows.length === 0) {
      throw new Error("No active collectors were found. Loan seeding cannot continue.");
    }

    const opsByBranch = new Map();
    for (const row of opsRows) {
      const branchOps = opsByBranch.get(row.branch_id) ?? { secretaries: [], managers: [] };
      if (row.role_name === "Secretary") {
        branchOps.secretaries.push(row);
      } else if (row.role_name === "Branch Manager") {
        branchOps.managers.push(row);
      }
      opsByBranch.set(row.branch_id, branchOps);
    }

    const collectorsByArea = new Map();
    for (const row of collectorRows) {
      if (!collectorsByArea.has(row.area_id)) {
        collectorsByArea.set(row.area_id, row);
      }
    }

    const branchAreaCollectors = new Map();
    for (const collector of collectorsByArea.values()) {
      const group = branchAreaCollectors.get(collector.branch_id) ?? [];
      group.push(collector);
      branchAreaCollectors.set(collector.branch_id, group);
    }

    const collectorPerformanceByArea = new Map();
    for (const [branchId, branchCollectors] of branchAreaCollectors.entries()) {
      for (const collector of assignCollectorPerformance(branchCollectors)) {
        collectorPerformanceByArea.set(collector.area_id, collector.performance);
      }

      const branchOps = opsByBranch.get(branchId);
      if (!branchOps?.secretaries.length && !branchOps?.managers.length) {
        throw new Error(`No same-branch secretary or branch manager found for branch ${branchCollectors[0]?.branch_name ?? branchId}.`);
      }
    }

    const borrowers = borrowerRows.map((row) => {
      const collector = collectorsByArea.get(row.area_id);
      if (!collector) {
        throw new Error(`No active collector assignment found for area ${row.area_code}.`);
      }

      return {
        ...row,
        collector_user_id: collector.user_id,
        collectorPerformance: collectorPerformanceByArea.get(row.area_id) ?? "average",
        branchProfile: buildBranchProfile(row.branch_name),
        branchOps: opsByBranch.get(row.branch_id) ?? { secretaries: [], managers: [] },
      };
    });

    const borrowersByBranch = new Map();
    for (const borrower of borrowers) {
      const group = borrowersByBranch.get(borrower.branch_id) ?? [];
      group.push(borrower);
      borrowersByBranch.set(borrower.branch_id, group);
    }

    const branchContexts = Array.from(borrowersByBranch.entries()).map(([branchId, branchBorrowers]) => ({
      branch_id: branchId,
      branch_name: branchBorrowers[0].branch_name,
      branchProfile: branchBorrowers[0].branchProfile,
      borrowers: branchBorrowers,
    }));

    const ubayBranch = branchContexts.find((branchContext) => branchContext.branch_name.toLowerCase().includes("ubay"));
    if (!ubayBranch) {
      throw new Error("Locked abandoned-loan branch (Ubay) was not found in the current database.");
    }

    const activeQuotaByBranch = allocateCountsByWeight(
      branchContexts,
      ACTIVE_TARGET,
      (item) => item.borrowers.length * item.branchProfile.activeWeight,
    );

    const chosenStatuses = new Map();
    const abandonedBorrower = chooseAbandonedBorrower(ubayBranch.borrowers);
    if (!abandonedBorrower) {
      throw new Error("Unable to choose the locked Ubay abandoned borrower.");
    }
    chosenStatuses.set(abandonedBorrower.user_id, "abandoned");

    const overdueBranchOrder = [
      branchContexts.find((item) => item.branch_name.toLowerCase().includes("cebu city")),
      branchContexts.find((item) => item.branch_name.toLowerCase().includes("tubigon")),
      ...branchContexts.filter((item) => !item.branch_name.toLowerCase().includes("ubay")),
    ].filter(Boolean);

    let overdueAssigned = 0;
    for (const branchContext of overdueBranchOrder) {
      if (overdueAssigned >= OVERDUE_TARGET) {
        break;
      }

      const available = branchContext.borrowers.filter((borrower) => !chosenStatuses.has(borrower.user_id));
      const overdueBorrower = chooseOverdueBorrower(available);
      if (!overdueBorrower) {
        continue;
      }

      chosenStatuses.set(overdueBorrower.user_id, "overdue");
      overdueAssigned += 1;
    }

    if (overdueAssigned !== OVERDUE_TARGET) {
      throw new Error(`Unable to allocate exactly ${OVERDUE_TARGET} overdue borrowers.`);
    }

    let activeAssigned = 0;
    for (const branchContext of branchContexts) {
      const quota = activeQuotaByBranch.get(branchContext.branch_id) ?? 0;
      if (quota <= 0) {
        continue;
      }

      const available = branchContext.borrowers.filter((borrower) => !chosenStatuses.has(borrower.user_id));
      for (const borrower of chooseActiveBorrowers(available, quota)) {
        chosenStatuses.set(borrower.user_id, "active");
        activeAssigned += 1;
      }
    }

    if (activeAssigned !== ACTIVE_TARGET) {
      throw new Error(`Unable to allocate exactly ${ACTIVE_TARGET} active borrowers.`);
    }

    const loanPlans = [];
    let activeIndex = 0;
    let overdueIndex = 0;

    for (const borrower of borrowers) {
      const finalStatus = chosenStatuses.get(borrower.user_id) ?? "completed";
      let totalLoans = chooseCompletedLoanCount(borrower);

      if (finalStatus === "abandoned") {
        totalLoans = Math.max(2, Math.min(totalLoans, 2));
      } else if (finalStatus === "overdue") {
        totalLoans = Math.max(2, Math.min(totalLoans + 1, 3));
      }

      const borrowerLoans = createLoanTimeline({
        borrower,
        totalLoans,
        finalStatus,
        quotaIndex: finalStatus === "active" ? activeIndex++ : finalStatus === "overdue" ? overdueIndex++ : 0,
      });

      if (finalStatus === "abandoned") {
        const finalLoan = borrowerLoans[borrowerLoans.length - 1];
        if (!finalLoan.branchName.toLowerCase().includes("ubay")) {
          throw new Error(`Abandoned loan landed outside Ubay: ${finalLoan.loanCode}.`);
        }
      }

      loanPlans.push(...borrowerLoans);
    }

    const loansByBorrower = new Map();
    for (const loan of loanPlans) {
      const group = loansByBorrower.get(loan.borrowerId) ?? [];
      group.push(loan);
      loansByBorrower.set(loan.borrowerId, group);
    }

    verifyNoOverlap(loansByBorrower);
    ensureUnique(loanPlans.map((loan) => loan.loanCode), "loan code");

    const statusCounts = loanPlans.reduce(
      (summary, loan) => {
        summary[loan.status] += 1;
        return summary;
      },
      { active: 0, overdue: 0, completed: 0, abandoned: 0 },
    );

    if (
      statusCounts.active !== ACTIVE_TARGET ||
      statusCounts.overdue !== OVERDUE_TARGET ||
      statusCounts.abandoned !== ABANDONED_TARGET
    ) {
      throw new Error(
        `Status shaping mismatch: active=${statusCounts.active}, overdue=${statusCounts.overdue}, abandoned=${statusCounts.abandoned}.`,
      );
    }

    const completedCandidates = loanPlans.filter(
      (loan) =>
        loan.status === "completed" &&
        loan.collectorPerformance !== "strong" &&
        generateScheduledCollectionDates({ startDate: loan.startDate, obligationCount: loan.termDays }).length >= 20,
    );
    const activeCandidates = loanPlans.filter((loan) => loan.status === "active");
    const overdueCandidates = loanPlans.filter((loan) => loan.status === "overdue");
    const abandonedCandidates = loanPlans.filter((loan) => loan.status === "abandoned");

    const missedLoanCodes = new Set();
    if (abandonedCandidates[0]) {
      missedLoanCodes.add(abandonedCandidates[0].loanCode);
    }
    if (overdueCandidates[0]) {
      missedLoanCodes.add(overdueCandidates[0].loanCode);
    }

    const remainingMissedSlots = MISSED_PAYMENT_TARGET - missedLoanCodes.size;
    const rankedAdditionalMissCandidates = [...completedCandidates, ...activeCandidates]
      .filter((loan) => !missedLoanCodes.has(loan.loanCode))
      .sort((left, right) => {
        const leftScore =
          fraction(`${left.loanCode}:miss`) +
          (left.collectorPerformance === "average" ? 0.15 : left.collectorPerformance === "above_average" ? 0.06 : -0.05);
        const rightScore =
          fraction(`${right.loanCode}:miss`) +
          (right.collectorPerformance === "average" ? 0.15 : right.collectorPerformance === "above_average" ? 0.06 : -0.05);
        return rightScore - leftScore;
      })
      .slice(0, remainingMissedSlots);

    for (const loan of rankedAdditionalMissCandidates) {
      missedLoanCodes.add(loan.loanCode);
    }

    if (missedLoanCodes.size !== MISSED_PAYMENT_TARGET) {
      throw new Error(`Unable to shape exactly ${MISSED_PAYMENT_TARGET} missed-payment instances.`);
    }

    const allCollectionRows = [];
    let missedCount = 0;
    let noteIndex = 0;

    loanPlans.sort((left, right) => {
      if (left.startDate !== right.startDate) {
        return left.startDate.localeCompare(right.startDate);
      }
      return left.loanCode.localeCompare(right.loanCode);
    });

    for (const loan of loanPlans) {
      const summary = buildCollectionRowsForLoan(loan, missedLoanCodes.has(loan.loanCode), noteIndex);
      noteIndex += summary.missedCount;
      allCollectionRows.push(...summary.rows);
      missedCount += summary.missedCount;
    }

    if (missedCount !== MISSED_PAYMENT_TARGET) {
      throw new Error(`Missed-payment shaping mismatch: expected ${MISSED_PAYMENT_TARGET}, got ${missedCount}.`);
    }

    ensureAllCollectionDatesValid(allCollectionRows);
    ensureUnique(allCollectionRows.map((row) => row.collectionCode), "collection code");

    const branchLoanCounts = new Map();
    for (const loan of loanPlans) {
      branchLoanCounts.set(loan.borrowerBranchName, (branchLoanCounts.get(loan.borrowerBranchName) ?? 0) + 1);
    }

    await sql.begin(async (tx) => {
      const loanColumns = [
        "loan_code",
        "borrower_id",
        "principal",
        "interest",
        "collector_id",
        "start_date",
        "due_date",
        "term_days",
        "branch_id",
        "created_at",
        "created_by",
        "status",
      ];

      const loanInsertRows = loanPlans.map((loan) => ({
        loan_code: loan.loanCode,
        borrower_id: loan.borrowerId,
        principal: loan.principal.toFixed(2),
        interest: String(loan.interest),
        collector_id: loan.collectorId,
        start_date: loan.startDate,
        due_date: loan.dueDate,
        term_days: loan.termDays,
        branch_id: loan.borrowerBranchId,
        created_at: loan.createdAt,
        created_by: loan.createdBy,
        status: loan.status,
      }));

      const insertedLoans = await tx`
        insert into loan_records ${tx(loanInsertRows, ...loanColumns)}
        returning loan_id, loan_code
      `;

      const loanIdByCode = new Map(insertedLoans.map((row) => [row.loan_code, row.loan_id]));
      const collectionColumns = [
        "collection_code",
        "loan_id",
        "collector_id",
        "amount",
        "note",
        "encoded_by",
        "collection_date",
        "created_at",
      ];
      const collectionInsertRows = allCollectionRows.map((row) => ({
        collection_code: row.collectionCode,
        loan_id: loanIdByCode.get(row.loanCode),
        collector_id: row.collectorId,
        amount: row.amount,
        note: row.note,
        encoded_by: row.encodedBy,
        collection_date: row.collectionDate,
        created_at: row.createdAt,
      }));

      for (const row of collectionInsertRows) {
        if (!row.loan_id) {
          throw new Error(`Missing inserted loan id for ${row.collection_code}.`);
        }
      }

      const chunkSize = 750;
      for (let index = 0; index < collectionInsertRows.length; index += chunkSize) {
        const chunk = collectionInsertRows.slice(index, index + chunkSize);
        await tx`
          insert into collections ${tx(chunk, ...collectionColumns)}
        `;
      }
    });

    console.log("Loan + collection seed summary");
    console.log(`Borrowers loaded: ${borrowers.length}`);
    console.log(`Loans created: ${loanPlans.length}`);
    console.log(`Collections created: ${allCollectionRows.length}`);
    console.log(`Completed loans: ${statusCounts.completed}`);
    console.log(`Active loans: ${statusCounts.active}`);
    console.log(`Overdue loans: ${statusCounts.overdue}`);
    console.log(`Abandoned loans: ${statusCounts.abandoned}`);
    console.log(`Missed-payment instances: ${missedCount}`);
    console.log("");
    console.log("Branch loan volume");
    for (const [branchName, count] of [...branchLoanCounts.entries()].sort((left, right) => right[1] - left[1])) {
      console.log(`- ${branchName}: ${count}`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Unknown loan + collection seed error.");
  process.exitCode = 1;
});
