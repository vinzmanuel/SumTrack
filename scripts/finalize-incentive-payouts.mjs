import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });

const PERIOD_START_MONTH = process.env.INCENTIVE_FINALIZE_START_MONTH ?? "2025-01";
const PERIOD_END_MONTH = process.env.INCENTIVE_FINALIZE_END_MONTH ?? "2026-03";

const MONTH_ABBREVIATIONS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseMonthValue(value) {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    return null;
  }
  const [yearRaw, monthRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

function toMonthValue(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function buildMonthWindow(monthValue) {
  const parsed = parseMonthValue(monthValue);
  if (!parsed) {
    return null;
  }

  const periodStart = `${monthValue}-01`;
  const periodEndDate = new Date(Date.UTC(parsed.year, parsed.month, 0));
  const periodEnd = periodEndDate.toISOString().slice(0, 10);

  return {
    month: monthValue,
    periodStart,
    periodEnd,
    periodLabel: `${MONTH_ABBREVIATIONS[parsed.month - 1]}-${parsed.year}`,
  };
}

function buildMonthSequence(startMonth, endMonth) {
  const parsedStart = parseMonthValue(startMonth);
  const parsedEnd = parseMonthValue(endMonth);
  if (!parsedStart || !parsedEnd) {
    throw new Error(`Invalid month range. start=${startMonth}, end=${endMonth}`);
  }

  let year = parsedStart.year;
  let month = parsedStart.month;
  const values = [];

  while (year < parsedEnd.year || (year === parsedEnd.year && month <= parsedEnd.month)) {
    values.push(toMonthValue(year, month));
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return values;
}

function keyForBranchRole(branchId, roleId) {
  return `${branchId}:${roleId}`;
}

function toMoney(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function computeIncentive(baseAmount, rule) {
  if (!rule) {
    return null;
  }
  return (baseAmount * rule.percentValue) / 100 + rule.flatAmount;
}

function buildRows(employees, roleName, roleId, branchId, branchName, baseAmountByUserId, fallbackBaseAmount, rule) {
  return employees.map((employee) => {
    const baseAmount = baseAmountByUserId.get(employee.user_id) ?? fallbackBaseAmount;
    const computedIncentive = computeIncentive(baseAmount, rule);
    const employeeName = [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(" ");
    return {
      userId: employee.user_id,
      employeeName,
      roleName,
      roleId,
      branchId,
      branchName,
      baseAmount,
      percentValue: rule?.percentValue ?? null,
      flatAmount: rule?.flatAmount ?? null,
      computedIncentive,
      missingRule: rule === null,
    };
  });
}

async function loadRoleIdMap(sql) {
  const rows = await sql`
    select role_id, role_name
    from roles
    where role_name in ('Collector', 'Secretary', 'Branch Manager')
  `;
  const roleIdByName = new Map();
  for (const row of rows) {
    roleIdByName.set(row.role_name, row.role_id);
  }
  return roleIdByName;
}

async function loadBranchFinalizerByManager(sql, branchManagerRoleId) {
  const rows = await sql`
    select
      eba.branch_id,
      u.user_id,
      u.company_id
    from employee_branch_assignment eba
    inner join users u on u.user_id = eba.employee_user_id
    where eba.end_date is null
      and u.status = 'active'
      and u.role_id = ${branchManagerRoleId}
    order by eba.branch_id asc, u.company_id asc, u.user_id asc
  `;

  const finalizerByBranchId = new Map();
  for (const row of rows) {
    if (!finalizerByBranchId.has(row.branch_id)) {
      finalizerByBranchId.set(row.branch_id, row.user_id);
    }
  }

  return finalizerByBranchId;
}

async function loadApplicableRuleMapForPeriod(sql, branchId, roleIds, periodStart, periodEnd) {
  if (roleIds.length === 0) {
    return new Map();
  }

  const rows = await sql`
    select
      ir.rule_id,
      ir.branch_id,
      ir.role_id,
      ir.percent_value,
      ir.flat_amount,
      ir.effective_start,
      ir.created_at
    from incentive_rules ir
    where ir.branch_id = ${branchId}
      and ir.effective_start <= ${periodStart}
      and (ir.effective_end is null or ir.effective_end >= ${periodEnd})
    order by
      ir.branch_id asc,
      ir.role_id asc,
      ir.effective_start desc,
      ir.created_at desc,
      ir.rule_id desc
  `;

  const map = new Map();
  for (const row of rows) {
    if (!roleIds.includes(row.role_id)) {
      continue;
    }
    const key = keyForBranchRole(row.branch_id, row.role_id);
    if (map.has(key)) {
      continue;
    }
    map.set(key, {
      percentValue: toMoney(row.percent_value),
      flatAmount: toMoney(row.flat_amount),
    });
  }

  return map;
}

async function computeLiveRowsForPeriod(sql, params) {
  const { branchId, branchName, periodStart, periodEnd, roleIdByName } = params;
  const collectorRoleId = roleIdByName.get("Collector");
  const secretaryRoleId = roleIdByName.get("Secretary");
  const branchManagerRoleId = roleIdByName.get("Branch Manager");

  const collectorEmployees = !collectorRoleId
    ? []
    : await sql`
      select
        u.user_id,
        u.company_id,
        ei.first_name,
        ei.middle_name,
        ei.last_name
      from employee_area_assignment eaa
      inner join areas a on a.area_id = eaa.area_id
      inner join users u on u.user_id = eaa.employee_user_id
      inner join employee_info ei on ei.user_id = u.user_id
      where a.branch_id = ${branchId}
        and u.role_id = ${collectorRoleId}
        and eaa.end_date is null
      order by ei.last_name asc, ei.first_name asc
    `;

  const secretaryEmployees = !secretaryRoleId
    ? []
    : await sql`
      select
        u.user_id,
        u.company_id,
        ei.first_name,
        ei.middle_name,
        ei.last_name
      from employee_branch_assignment eba
      inner join users u on u.user_id = eba.employee_user_id
      inner join employee_info ei on ei.user_id = u.user_id
      where eba.branch_id = ${branchId}
        and u.role_id = ${secretaryRoleId}
        and eba.end_date is null
      order by ei.last_name asc, ei.first_name asc
    `;

  const branchManagerEmployees = !branchManagerRoleId
    ? []
    : await sql`
      select
        u.user_id,
        u.company_id,
        ei.first_name,
        ei.middle_name,
        ei.last_name
      from employee_branch_assignment eba
      inner join users u on u.user_id = eba.employee_user_id
      inner join employee_info ei on ei.user_id = u.user_id
      where eba.branch_id = ${branchId}
        and u.role_id = ${branchManagerRoleId}
        and eba.end_date is null
      order by ei.last_name asc, ei.first_name asc
    `;

  const collectorIds = collectorEmployees.map((employee) => employee.user_id);
  const collectorTotalsRows = collectorIds.length === 0
    ? []
    : await sql`
      select
        lr.collector_id,
        coalesce(sum(c.amount), 0) as total_amount
      from collections c
      inner join loan_records lr on lr.loan_id = c.loan_id
      where lr.branch_id = ${branchId}
        and c.collection_date >= ${periodStart}
        and c.collection_date <= ${periodEnd}
      group by lr.collector_id
    `;

  const collectorBaseAmountByUserId = new Map(
    collectorTotalsRows
      .filter((row) => Boolean(row.collector_id))
      .map((row) => [row.collector_id, toMoney(row.total_amount)]),
  );

  const collectorTotalAcrossBranch = collectorEmployees.reduce(
    (sum, employee) => sum + (collectorBaseAmountByUserId.get(employee.user_id) ?? 0),
    0,
  );
  const branchCollectorAverage =
    collectorEmployees.length > 0 ? collectorTotalAcrossBranch / collectorEmployees.length : 0;

  const roleIdsToLoad = [collectorRoleId, secretaryRoleId, branchManagerRoleId].filter((value) =>
    typeof value === "number"
  );
  const ruleMap = await loadApplicableRuleMapForPeriod(
    sql,
    branchId,
    roleIdsToLoad,
    periodStart,
    periodEnd,
  );

  const collectorRule = collectorRoleId ? ruleMap.get(keyForBranchRole(branchId, collectorRoleId)) ?? null : null;
  const secretaryRule = secretaryRoleId ? ruleMap.get(keyForBranchRole(branchId, secretaryRoleId)) ?? null : null;
  const branchManagerRule = branchManagerRoleId
    ? ruleMap.get(keyForBranchRole(branchId, branchManagerRoleId)) ?? null
    : null;

  const collectorRows = collectorRoleId
    ? buildRows(
      collectorEmployees,
      "Collector",
      collectorRoleId,
      branchId,
      branchName,
      collectorBaseAmountByUserId,
      0,
      collectorRule,
    )
    : [];
  const secretaryRows = secretaryRoleId
    ? buildRows(
      secretaryEmployees,
      "Secretary",
      secretaryRoleId,
      branchId,
      branchName,
      new Map(),
      branchCollectorAverage,
      secretaryRule,
    )
    : [];
  const branchManagerRows = branchManagerRoleId
    ? buildRows(
      branchManagerEmployees,
      "Branch Manager",
      branchManagerRoleId,
      branchId,
      branchName,
      new Map(),
      branchCollectorAverage,
      branchManagerRule,
    )
    : [];

  return {
    collectorRows,
    secretaryRows,
    branchManagerRows,
  };
}

async function main() {
  const databaseUrl = requireEnv("DATABASE_URL");
  const sql = postgres(databaseUrl, { prepare: false });

  try {
    const periods = buildMonthSequence(PERIOD_START_MONTH, PERIOD_END_MONTH)
      .map((month) => buildMonthWindow(month))
      .filter(Boolean);
    if (periods.length === 0) {
      throw new Error("No valid period windows were generated.");
    }

    const roleIdByName = await loadRoleIdMap(sql);
    const branchManagerRoleId = roleIdByName.get("Branch Manager");
    if (!branchManagerRoleId) {
      throw new Error("Branch Manager role was not found.");
    }
    const finalizerByBranchId = await loadBranchFinalizerByManager(sql, branchManagerRoleId);
    const activeBranches = await sql`
      select branch_id, branch_name
      from branch
      where status = 'active'
      order by branch_name asc
    `;

    if (activeBranches.length === 0) {
      throw new Error("No active branches found.");
    }

    const summary = {
      createdBatches: 0,
      createdRows: 0,
      skippedExisting: 0,
      skippedMissingRules: 0,
      skippedMissingBranchManager: 0,
      skippedNoCollections: 0,
      failures: 0,
    };

    console.log(`Incentive auto-finalize window: ${PERIOD_START_MONTH} to ${PERIOD_END_MONTH}`);
    console.log(`Active branches: ${activeBranches.length}`);
    console.log(`Branches with active manager finalizer: ${finalizerByBranchId.size}`);
    console.log("");

    for (const period of periods) {
      let periodCreated = 0;
      let periodExisting = 0;
      let periodMissingRules = 0;
      let periodMissingBranchManager = 0;
      let periodNoCollections = 0;
      let periodFailures = 0;

      for (const branchRow of activeBranches) {
        try {
          const finalizerUserId = finalizerByBranchId.get(branchRow.branch_id) ?? null;
          if (!finalizerUserId) {
            summary.skippedMissingBranchManager += 1;
            periodMissingBranchManager += 1;
            console.warn(
              `[skip][no branch manager] ${period.month} | ${branchRow.branch_name}: no active branch manager assignment found.`,
            );
            continue;
          }

          const existingBatch = await sql`
            select batch_id
            from incentive_payout_batches
            where branch_id = ${branchRow.branch_id}
              and period_start = ${period.periodStart}
              and period_end = ${period.periodEnd}
            limit 1
          `;
          if (existingBatch.length > 0) {
            summary.skippedExisting += 1;
            periodExisting += 1;
            continue;
          }

          const periodCollectionCountRows = await sql`
            select count(*)::int as collection_count
            from collections c
            inner join loan_records lr on lr.loan_id = c.loan_id
            where lr.branch_id = ${branchRow.branch_id}
              and c.collection_date >= ${period.periodStart}
              and c.collection_date <= ${period.periodEnd}
          `;
          const periodCollectionCount = Number(periodCollectionCountRows[0]?.collection_count ?? 0);
          if (periodCollectionCount <= 0) {
            summary.skippedNoCollections += 1;
            periodNoCollections += 1;
            continue;
          }

          const liveData = await computeLiveRowsForPeriod(sql, {
            branchId: branchRow.branch_id,
            branchName: branchRow.branch_name,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            roleIdByName,
          });

          const allRows = [
            ...liveData.collectorRows,
            ...liveData.secretaryRows,
            ...liveData.branchManagerRows,
          ];
          const missingRoles = Array.from(
            new Set(allRows.filter((row) => row.missingRule).map((row) => row.roleName)),
          );
          if (missingRoles.length > 0) {
            summary.skippedMissingRules += 1;
            periodMissingRules += 1;
            console.warn(
              `[skip][missing rules] ${period.month} | ${branchRow.branch_name}: ${missingRoles.join(", ")}`,
            );
            continue;
          }

          await sql.begin(async (tx) => {
            const insertedBatch = await tx`
              insert into incentive_payout_batches (
                branch_id,
                period_label,
                period_start,
                period_end,
                finalized_by
              ) values (
                ${branchRow.branch_id},
                ${period.periodLabel},
                ${period.periodStart},
                ${period.periodEnd},
                ${finalizerUserId}
              )
              returning batch_id
            `;

            const batchId = insertedBatch[0]?.batch_id ?? null;
            if (!batchId) {
              throw new Error("Failed to create payout batch.");
            }

            if (allRows.length === 0) {
              return;
            }

            await tx`
              insert into incentive_payout_history (
                batch_id,
                employee_user_id,
                role_id,
                base_amount,
                percent_value,
                flat_amount,
                computed_incentive
              ) values ${tx(
                allRows.map((row) => [
                  batchId,
                  row.userId,
                  row.roleId,
                  row.baseAmount.toFixed(2),
                  (row.percentValue ?? 0).toFixed(2),
                  (row.flatAmount ?? 0).toFixed(2),
                  (row.computedIncentive ?? 0).toFixed(2),
                ]),
              )}
            `;
          });

          summary.createdBatches += 1;
          summary.createdRows += allRows.length;
          periodCreated += 1;
        } catch (error) {
          summary.failures += 1;
          periodFailures += 1;
          const message = error instanceof Error ? error.message : "Unknown error.";
          console.error(`[failed] ${period.month} | ${branchRow.branch_name}: ${message}`);
        }
      }

      console.log(
        `[${period.month}] created=${periodCreated}, skipped_existing=${periodExisting}, skipped_missing_rules=${periodMissingRules}, skipped_missing_branch_manager=${periodMissingBranchManager}, skipped_no_collections=${periodNoCollections}, failures=${periodFailures}`,
      );
    }

    console.log("");
    console.log("Incentive auto-finalize summary");
    console.log(`Batches created: ${summary.createdBatches}`);
    console.log(`Payout rows created: ${summary.createdRows}`);
    console.log(`Skipped (already finalized): ${summary.skippedExisting}`);
    console.log(`Skipped (missing rules): ${summary.skippedMissingRules}`);
    console.log(`Skipped (no active branch manager): ${summary.skippedMissingBranchManager}`);
    console.log(`Skipped (no collections in branch-month): ${summary.skippedNoCollections}`);
    console.log(`Failures: ${summary.failures}`);

    if (summary.failures > 0) {
      process.exitCode = 1;
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Unknown incentive finalization script error.");
  process.exitCode = 1;
});
