import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });

const SEED_START_DATE = "2025-01-01";
const SEED_END_DATE = "2026-04-08";
const FIXED_CATEGORY_ORDER = ["Rent", "Electricity", "Water", "Salary", "Transportation", "Lunch", "Miscellaneous"];

const MISCELLANEOUS_DESCRIPTIONS = [
  "Printer ink refill for branch paperwork.",
  "Small office repair materials for front desk drawer.",
  "Branch cleaning supplies replenishment.",
  "Receipt booklet replenishment for daily transactions.",
  "Fan maintenance and replacement parts.",
  "Internet backup load for temporary connectivity issue.",
  "Extension cord and outlet adapter replacement.",
  "Document organizer and folder replenishment.",
  "Queue marker tape and signage materials.",
  "Lock replacement for records cabinet.",
  "Basic pantry and sanitation replenishment.",
  "Wall clock battery and small fixture replacement.",
];

const TRANSPORTATION_DESCRIPTIONS = [
  "Transportation reimbursement for branch bank errand.",
  "Fuel reimbursement for area field visit.",
  "Motorcycle fuel support for document delivery.",
  "Transportation expense for collections coordination run.",
  "Fare reimbursement for same-day branch supply pickup.",
  "Transportation support for municipal office errand.",
];

const LUNCH_DESCRIPTIONS = [
  "Lunch for branch operations catch-up.",
  "Lunch during month-end records reconciliation.",
  "Lunch for collection route planning session.",
  "Lunch during weekend branch cleanup support.",
  "Lunch for payroll day overtime support.",
  "Lunch during reporting and filing day.",
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

function pick(list, seed) {
  return list[Math.abs(seed) % list.length];
}

function buildMonthWindows(start, end) {
  const months = [];
  let year = start.year;
  let month = start.month;

  while (year < end.year || (year === end.year && month <= end.month)) {
    months.push({
      year,
      month,
      key: `${year}-${String(month).padStart(2, "0")}`,
      monthLabel: new Intl.DateTimeFormat("en-PH", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(Date.UTC(year, month - 1, 1))),
      lastDay: new Date(Date.UTC(year, month, 0)).getUTCDate(),
    });

    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return months;
}

function toIsoDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function parseIsoDate(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoDateInRange(isoDate, startIsoDate, endIsoDate) {
  return isoDate >= startIsoDate && isoDate <= endIsoDate;
}

function weekdayOrPrevious(date) {
  const next = new Date(date);
  while (next.getUTCDay() === 0 || next.getUTCDay() === 6) {
    next.setUTCDate(next.getUTCDate() - 1);
  }
  return next;
}

function chooseRecurringDate(monthWindow, seedKey, minDay, maxDay) {
  const safeMin = clamp(minDay, 1, monthWindow.lastDay);
  const safeMax = clamp(maxDay, safeMin, monthWindow.lastDay);
  const span = safeMax - safeMin + 1;
  const chosenDay = safeMin + (hashString(seedKey) % span);
  const date = weekdayOrPrevious(new Date(Date.UTC(monthWindow.year, monthWindow.month - 1, chosenDay)));
  return date.toISOString().slice(0, 10);
}

function chooseSalaryDates(monthWindow) {
  const midMonth = weekdayOrPrevious(new Date(Date.UTC(monthWindow.year, monthWindow.month - 1, 15)));
  const monthEnd = weekdayOrPrevious(new Date(Date.UTC(monthWindow.year, monthWindow.month, 0)));
  return {
    midMonth: midMonth.toISOString().slice(0, 10),
    monthEnd: monthEnd.toISOString().slice(0, 10),
  };
}

function roundMoney(value, step = 50) {
  return Math.max(step, Math.round(value / step) * step);
}

function buildRecordedAt(isoDate, category, indexSeed) {
  const hourBase =
    category === "Salary"
      ? 16
      : category === "Rent"
        ? 10
        : category === "Electricity" || category === "Water"
          ? 14
          : 12;
  const minute = String((hashString(`${isoDate}:${category}:${indexSeed}:minute`) % 50) + 10).padStart(2, "0");
  return `${isoDate}T${String(hourBase).padStart(2, "0")}:${minute}:00.000Z`;
}

function resolveBranchProfile(branchName) {
  const normalized = String(branchName).trim().toLowerCase();

  if (normalized.includes("cebu city")) {
    return {
      key: "cebu-city",
      rank: 1,
      heaviness: 1.22,
      rentBase: 28000,
      electricityBase: 7600,
      waterBase: 2200,
      salaryMidBase: 36000,
      transportationCountRange: [7, 9],
      lunchCountRange: [5, 7],
      miscellaneousCountRange: [3, 4],
      transportationRange: [650, 2200],
      lunchRange: [350, 1300],
      miscellaneousRange: [700, 3800],
      predictability: 0.82,
    };
  }

  if (normalized.includes("tagbilaran")) {
    return {
      key: "tagbilaran",
      rank: 2,
      heaviness: 1.14,
      rentBase: 23500,
      electricityBase: 6500,
      waterBase: 1900,
      salaryMidBase: 33500,
      transportationCountRange: [6, 8],
      lunchCountRange: [4, 6],
      miscellaneousCountRange: [3, 4],
      transportationRange: [550, 1850],
      lunchRange: [320, 1150],
      miscellaneousRange: [650, 3400],
      predictability: 0.84,
    };
  }

  if (normalized.includes("mandaue")) {
    return {
      key: "mandaue",
      rank: 3,
      heaviness: 1.04,
      rentBase: 20000,
      electricityBase: 5600,
      waterBase: 1700,
      salaryMidBase: 30000,
      transportationCountRange: [5, 6],
      lunchCountRange: [4, 5],
      miscellaneousCountRange: [2, 4],
      transportationRange: [450, 1550],
      lunchRange: [260, 950],
      miscellaneousRange: [500, 2900],
      predictability: 0.88,
    };
  }

  if (normalized.includes("tubigon")) {
    return {
      key: "tubigon",
      rank: 4,
      heaviness: 0.94,
      rentBase: 16000,
      electricityBase: 4500,
      waterBase: 1450,
      salaryMidBase: 25500,
      transportationCountRange: [4, 5],
      lunchCountRange: [3, 4],
      miscellaneousCountRange: [2, 3],
      transportationRange: [320, 1200],
      lunchRange: [220, 780],
      miscellaneousRange: [420, 2200],
      predictability: 0.92,
    };
  }

  if (normalized.includes("ubay")) {
    return {
      key: "ubay",
      rank: 5,
      heaviness: 0.9,
      rentBase: 15000,
      electricityBase: 4050,
      waterBase: 1350,
      salaryMidBase: 24500,
      transportationCountRange: [3, 4],
      lunchCountRange: [2, 3],
      miscellaneousCountRange: [2, 3],
      transportationRange: [280, 1050],
      lunchRange: [200, 720],
      miscellaneousRange: [380, 2000],
      predictability: 0.94,
    };
  }

  return {
    key: normalized || "default",
    rank: 6,
    heaviness: 1,
    rentBase: 18000,
    electricityBase: 5000,
    waterBase: 1600,
    salaryMidBase: 28500,
    transportationCountRange: [4, 5],
    lunchCountRange: [3, 4],
    miscellaneousCountRange: [2, 3],
    transportationRange: [350, 1300],
    lunchRange: [240, 900],
    miscellaneousRange: [450, 2400],
    predictability: 0.9,
  };
}

function rangeValue(min, max, seedKey) {
  if (max <= min) {
    return min;
  }
  const span = max - min;
  return min + Math.round(fraction(seedKey) * span);
}

function rangeCount([min, max], seedKey) {
  return rangeValue(min, max, seedKey);
}

function chooseManagerUserId(managers, seedKey) {
  return managers[hashString(seedKey) % managers.length].user_id;
}

function buildRecurringRows(branchContext, monthWindow) {
  const profile = branchContext.profile;
  const salaryDates = chooseSalaryDates(monthWindow);

  const rentAmount = roundMoney(
    profile.rentBase * (1 + (fraction(`${branchContext.branch_name}:${monthWindow.key}:rent`) - 0.5) * 0.06),
    100,
  );
  const electricityVariance = 0.14 - (profile.predictability - 0.8) * 0.08;
  const electricityAmount = roundMoney(
    profile.electricityBase *
      (1 + (fraction(`${branchContext.branch_name}:${monthWindow.key}:electricity`) - 0.5) * electricityVariance),
    50,
  );
  const waterAmount = roundMoney(
    profile.waterBase * (1 + (fraction(`${branchContext.branch_name}:${monthWindow.key}:water`) - 0.5) * 0.08),
    50,
  );
  const salaryMidAmount = roundMoney(
    profile.salaryMidBase *
      (1 + (fraction(`${branchContext.branch_name}:${monthWindow.key}:salary-mid`) - 0.5) * 0.08),
    100,
  );
  const salaryUplift = roundMoney(
    rangeValue(4000, 6000, `${branchContext.branch_name}:${monthWindow.key}:salary-uplift`),
    100,
  );
  const salaryMonthEndAmount = salaryMidAmount + salaryUplift;

  return [
    {
      category: "Rent",
      amount: rentAmount,
      description: `Monthly branch rent for ${monthWindow.monthLabel}.`,
      expenseDate: chooseRecurringDate(monthWindow, `${branchContext.branch_name}:${monthWindow.key}:rent-date`, 3, 6),
      recordedBy: chooseManagerUserId(branchContext.managers, `${monthWindow.key}:Rent`),
    },
    {
      category: "Electricity",
      amount: electricityAmount,
      description: `Electricity bill for ${monthWindow.monthLabel}.`,
      expenseDate: chooseRecurringDate(monthWindow, `${branchContext.branch_name}:${monthWindow.key}:electricity-date`, 10, 16),
      recordedBy: chooseManagerUserId(branchContext.managers, `${monthWindow.key}:Electricity`),
    },
    {
      category: "Water",
      amount: waterAmount,
      description: `Water bill for ${monthWindow.monthLabel}.`,
      expenseDate: chooseRecurringDate(monthWindow, `${branchContext.branch_name}:${monthWindow.key}:water-date`, 12, 18),
      recordedBy: chooseManagerUserId(branchContext.managers, `${monthWindow.key}:Water`),
    },
    {
      category: "Salary",
      amount: salaryMidAmount,
      description: `15th payroll payout for ${monthWindow.monthLabel}.`,
      expenseDate: salaryDates.midMonth,
      recordedBy: chooseManagerUserId(branchContext.managers, `${monthWindow.key}:Salary:mid`),
    },
    {
      category: "Salary",
      amount: salaryMonthEndAmount,
      description: `End-of-month payroll payout for ${monthWindow.monthLabel} with incentive uplift.`,
      expenseDate: salaryDates.monthEnd,
      recordedBy: chooseManagerUserId(branchContext.managers, `${monthWindow.key}:Salary:end`),
    },
  ];
}

function generateUniqueMonthDates(monthWindow, count, seedKey, minDay, maxDay) {
  const used = new Set();
  const dates = [];
  const safeMin = clamp(minDay, 1, monthWindow.lastDay);
  const safeMax = clamp(maxDay, safeMin, monthWindow.lastDay);
  const span = safeMax - safeMin + 1;

  for (let index = 0; index < count; index += 1) {
    let offset = hashString(`${seedKey}:${index}`) % span;
    let attempts = 0;
    while (attempts < span) {
      const day = safeMin + ((offset + attempts) % span);
      const isoDate = toIsoDate(monthWindow.year, monthWindow.month, day);
      if (!used.has(isoDate)) {
        used.add(isoDate);
        dates.push(isoDate);
        break;
      }
      attempts += 1;
    }
  }

  return dates.sort((left, right) => left.localeCompare(right));
}

function buildRandomCategoryRows(branchContext, monthWindow, category) {
  const profile = branchContext.profile;
  const seedBase = `${branchContext.branch_name}:${monthWindow.key}:${category}`;
  let countRange;
  let amountRange;
  let descriptions;
  let minDay;
  let maxDay;
  let step;

  if (category === "Transportation") {
    countRange = profile.transportationCountRange;
    amountRange = profile.transportationRange;
    descriptions = TRANSPORTATION_DESCRIPTIONS;
    minDay = 2;
    maxDay = monthWindow.lastDay - 1;
    step = 50;
  } else if (category === "Lunch") {
    countRange = profile.lunchCountRange;
    amountRange = profile.lunchRange;
    descriptions = LUNCH_DESCRIPTIONS;
    minDay = 4;
    maxDay = monthWindow.lastDay - 1;
    step = 20;
  } else {
    countRange = profile.miscellaneousCountRange;
    amountRange = profile.miscellaneousRange;
    descriptions = MISCELLANEOUS_DESCRIPTIONS;
    minDay = 5;
    maxDay = monthWindow.lastDay - 1;
    step = 50;
  }

  const count = rangeCount(countRange, `${seedBase}:count`);
  const dates = generateUniqueMonthDates(monthWindow, count, `${seedBase}:dates`, minDay, maxDay);

  return dates.map((expenseDate, index) => {
    const description = pick(descriptions, hashString(`${seedBase}:description:${index}`));
    const rawAmount = rangeValue(amountRange[0], amountRange[1], `${seedBase}:amount:${index}`);
    const scaledAmount =
      category === "Transportation" && branchContext.profile.rank <= 2
        ? rawAmount * 1.06
        : category === "Lunch" && branchContext.profile.rank >= 4
          ? rawAmount * 0.94
          : rawAmount;

    return {
      category,
      amount: roundMoney(scaledAmount, step),
      description,
      expenseDate,
      recordedBy: chooseManagerUserId(branchContext.managers, `${seedBase}:manager:${index}`),
    };
  });
}

function buildExpenseRowsForBranchMonth(branchContext, monthWindow) {
  return [
    ...buildRecurringRows(branchContext, monthWindow),
    ...buildRandomCategoryRows(branchContext, monthWindow, "Transportation"),
    ...buildRandomCategoryRows(branchContext, monthWindow, "Lunch"),
    ...buildRandomCategoryRows(branchContext, monthWindow, "Miscellaneous"),
  ]
    .sort((left, right) => {
      if (left.expenseDate !== right.expenseDate) {
        return left.expenseDate.localeCompare(right.expenseDate);
      }
      const categoryDiff = FIXED_CATEGORY_ORDER.indexOf(left.category) - FIXED_CATEGORY_ORDER.indexOf(right.category);
      if (categoryDiff !== 0) {
        return categoryDiff;
      }
      return left.description.localeCompare(right.description);
    })
    .map((row, index) => ({
      branchId: branchContext.branch_id,
      branchName: branchContext.branch_name,
      category: row.category,
      amount: row.amount,
      description: row.description,
      expenseDate: row.expenseDate,
      recordedBy: row.recordedBy,
      recordedAt: buildRecordedAt(row.expenseDate, row.category, `${monthWindow.key}:${index}`),
      monthKey: monthWindow.key,
    }));
}

function summarizeBranch(rows) {
  return rows.reduce(
    (summary, row) => {
      summary.count += 1;
      summary.amount += row.amount;
      summary.categories[row.category] = (summary.categories[row.category] ?? 0) + 1;
      return summary;
    },
    { count: 0, amount: 0, categories: {} },
  );
}

async function main() {
  const databaseUrl = requireEnv("DATABASE_URL");
  const sql = postgres(databaseUrl, { prepare: false });

  try {
    const parsedSeedStartDate = parseIsoDate(SEED_START_DATE);
    const parsedSeedEndDate = parseIsoDate(SEED_END_DATE);
    if (!parsedSeedStartDate || !parsedSeedEndDate) {
      throw new Error(`Invalid seed date window. Start=${SEED_START_DATE}, End=${SEED_END_DATE}`);
    }
    if (parsedSeedStartDate > parsedSeedEndDate) {
      throw new Error(`Invalid seed date window: start date ${SEED_START_DATE} is after end date ${SEED_END_DATE}.`);
    }

    const [existingCounts] = await sql`
      select count(*)::int as expense_count
      from expenses
    `;

    if ((existingCounts?.expense_count ?? 0) > 0) {
      throw new Error(
        `Seed refused: expenses already contains ${existingCounts.expense_count} row(s). This runner only seeds into a clean expenses dataset.`,
      );
    }

    const branchRows = await sql`
      select
        b.branch_id,
        b.branch_name
      from branch b
      where b.status = 'active'
      order by b.branch_name asc
    `;

    if (branchRows.length === 0) {
      throw new Error("No active branches were found. Expense seed cannot continue.");
    }

    const managerRows = await sql`
      select
        eba.branch_id,
        b.branch_name,
        u.user_id,
        u.company_id,
        ei.first_name,
        ei.last_name
      from employee_branch_assignment eba
      inner join users u on u.user_id = eba.employee_user_id
      inner join roles r on r.role_id = u.role_id
      inner join employee_info ei on ei.user_id = u.user_id
      inner join branch b on b.branch_id = eba.branch_id
      where r.role_name = 'Branch Manager'
        and u.status = 'active'
        and b.status = 'active'
        and eba.end_date is null
      order by b.branch_name asc, u.company_id asc
    `;

    const managersByBranch = new Map();
    for (const managerRow of managerRows) {
      const branchManagers = managersByBranch.get(managerRow.branch_id) ?? [];
      branchManagers.push(managerRow);
      managersByBranch.set(managerRow.branch_id, branchManagers);
    }

    const branchContexts = branchRows.map((branchRow) => {
      const managers = managersByBranch.get(branchRow.branch_id) ?? [];
      if (managers.length === 0) {
        throw new Error(`No active Branch Manager assignment found for branch ${branchRow.branch_name}.`);
      }

      return {
        ...branchRow,
        managers,
        profile: resolveBranchProfile(branchRow.branch_name),
      };
    });

    if (branchContexts.length !== 5) {
      console.warn(`Expected 5 active branches for the locked seed shape, but found ${branchContexts.length}.`);
    }

    const monthWindows = buildMonthWindows(
      {
        year: parsedSeedStartDate.getUTCFullYear(),
        month: parsedSeedStartDate.getUTCMonth() + 1,
      },
      {
        year: parsedSeedEndDate.getUTCFullYear(),
        month: parsedSeedEndDate.getUTCMonth() + 1,
      },
    );
    const expenseRows = [];

    for (const branchContext of branchContexts) {
      for (const monthWindow of monthWindows) {
        const monthRows = buildExpenseRowsForBranchMonth(branchContext, monthWindow).filter((row) =>
          isoDateInRange(row.expenseDate, SEED_START_DATE, SEED_END_DATE),
        );
        expenseRows.push(...monthRows);
      }
    }

    const insertRows = expenseRows.map((row) => ({
      branch_id: row.branchId,
      amount: row.amount.toFixed(2),
      expense_category: row.category,
      description: row.description,
      expense_date: row.expenseDate,
      recorded_by: row.recordedBy,
      recorded_at: row.recordedAt,
    }));

    await sql.begin(async (tx) => {
      await tx`
        insert into expenses ${tx(insertRows, "branch_id", "amount", "expense_category", "description", "expense_date", "recorded_by", "recorded_at")}
      `;
    });

    console.log("Expense seed summary");
    console.log(`Active branches: ${branchContexts.length}`);
    console.log(`Months covered: ${monthWindows.length}`);
    console.log(`Date window: ${SEED_START_DATE} to ${SEED_END_DATE}`);
    console.log(`Expenses created: ${expenseRows.length}`);
    console.log("");

    for (const branchContext of [...branchContexts].sort((left, right) => left.profile.rank - right.profile.rank)) {
      const branchRowsForSummary = expenseRows.filter((row) => row.branchId === branchContext.branch_id);
      const summary = summarizeBranch(branchRowsForSummary);
      console.log(`${branchContext.branch_name}: ${summary.count} rows, PHP ${summary.amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      console.log(
        `  Rent=${summary.categories.Rent ?? 0}, Electricity=${summary.categories.Electricity ?? 0}, Water=${summary.categories.Water ?? 0}, Salary=${summary.categories.Salary ?? 0}, Transportation=${summary.categories.Transportation ?? 0}, Lunch=${summary.categories.Lunch ?? 0}, Miscellaneous=${summary.categories.Miscellaneous ?? 0}`,
      );
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Unknown expense seed error.");
  process.exitCode = 1;
});
