import { randomInt } from "node:crypto";
import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });

const MOBILE_PREFIXES = [
  "0917",
  "0918",
  "0919",
  "0920",
  "0921",
  "0922",
  "0923",
  "0925",
  "0926",
  "0927",
  "0928",
  "0929",
  "0930",
  "0932",
  "0933",
  "0935",
  "0936",
  "0937",
  "0938",
  "0939",
  "0945",
  "0946",
  "0947",
  "0948",
  "0949",
  "0950",
  "0951",
  "0955",
  "0956",
  "0961",
  "0963",
  "0965",
  "0966",
  "0967",
  "0975",
  "0976",
  "0977",
  "0978",
  "0979",
  "0995",
  "0996",
  "0997",
  "0998",
  "0999",
];

const EMAIL_DOMAINS = ["gmail.com", "yahoo.com"];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizeNamePart(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function buildEmailBase(row) {
  const firstName = normalizeNamePart(row.first_name);
  const middleName = normalizeNamePart(row.middle_name);
  const lastName = normalizeNamePart(row.last_name);
  const firstSegment = firstName || middleName || "borrower";
  const lastSegment = lastName || "account";
  return `${firstSegment}${lastSegment}`;
}

function buildUniqueEmail(row, usedEmails) {
  const base = buildEmailBase(row);
  let attempt = 0;

  while (attempt < 500) {
    const domain = EMAIL_DOMAINS[(row.sort_index + attempt) % EMAIL_DOMAINS.length];
    const suffix = attempt === 0 ? "" : String(attempt + 1);
    const candidate = `${base}${suffix}@${domain}`;

    if (!usedEmails.has(candidate)) {
      usedEmails.add(candidate);
      return candidate;
    }

    attempt += 1;
  }

  throw new Error(`Unable to generate a unique email for ${row.user_id}.`);
}

function buildUniqueContactNo(usedContactNos) {
  let attempt = 0;

  while (attempt < 5000) {
    const prefix = MOBILE_PREFIXES[randomInt(MOBILE_PREFIXES.length)];
    const body = String(randomInt(0, 10_000_000)).padStart(7, "0");
    const candidate = `${prefix}${body}`;

    if (!usedContactNos.has(candidate)) {
      usedContactNos.add(candidate);
      return candidate;
    }

    attempt += 1;
  }

  throw new Error("Unable to generate a unique contact number.");
}

async function main() {
  const databaseUrl = requireEnv("DATABASE_URL");
  const sql = postgres(databaseUrl, { prepare: false });

  try {
    const borrowerRoleRows = await sql`
      select role_id
      from roles
      where role_name = 'Borrower'
      limit 1
    `;

    if (borrowerRoleRows.length === 0) {
      throw new Error("Borrower role was not found.");
    }

    const borrowerRoleId = borrowerRoleRows[0].role_id;

    const borrowerRows = await sql`
      select
        u.user_id,
        u.email,
        u.contact_no,
        bi.first_name,
        bi.middle_name,
        bi.last_name,
        row_number() over (
          order by u.company_id asc, u.user_id asc
        )::integer as sort_index
      from users u
      inner join borrower_info bi on bi.user_id = u.user_id
      where u.role_id = ${borrowerRoleId}
      order by u.company_id asc, u.user_id asc
    `;

    if (borrowerRows.length === 0) {
      console.log("No borrower users found. Nothing to refresh.");
      return;
    }

    const existingContactRows = await sql`
      select user_id, email, contact_no
      from users
    `;

    const usedEmails = new Set();
    const usedContactNos = new Set();

    for (const row of existingContactRows) {
      if (row.email) {
        usedEmails.add(String(row.email).toLowerCase());
      }
      if (row.contact_no) {
        usedContactNos.add(String(row.contact_no));
      }
    }

    for (const borrower of borrowerRows) {
      if (borrower.email) {
        usedEmails.delete(String(borrower.email).toLowerCase());
      }
      if (borrower.contact_no) {
        usedContactNos.delete(String(borrower.contact_no));
      }
    }

    let updated = 0;
    let skipped = 0;
    let failures = 0;

    for (const borrower of borrowerRows) {
      try {
        const nextEmail = buildUniqueEmail(borrower, usedEmails);
        const nextContactNo = buildUniqueContactNo(usedContactNos);

        await sql`
          update users
          set
            email = ${nextEmail},
            contact_no = ${nextContactNo}
          where user_id = ${borrower.user_id}
            and role_id = ${borrowerRoleId}
        `;

        updated += 1;
      } catch (error) {
        failures += 1;
        console.error(
          `[failed] ${borrower.user_id}: ${error instanceof Error ? error.message : "Unknown error."}`,
        );
      }
    }

    console.log("Borrower contact refresh summary");
    console.log(`Borrowers scanned: ${borrowerRows.length}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Failures: ${failures}`);

    if (failures > 0) {
      process.exitCode = 1;
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Unknown fatal error.");
  process.exitCode = 1;
});
