import { randomInt, randomUUID } from "node:crypto";
import dotenv from "dotenv";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const BORROWERS_PER_AREA = 30;
const INTERNAL_AUTH_DOMAIN = "sumtrack.local";
const DEFAULT_SEED_PASSWORD = process.env.BORROWER_SEED_PASSWORD ?? "Borrower123!";
const SEED_CREATED_BY_USER_ID = process.env.BORROWER_SEED_CREATED_BY ?? null;
const EMAIL_DOMAINS = ["gmail.com", "yahoo.com"];

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
  "0946",
  "0945",
  "0948",
  "0947",
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

const FIRST_NAMES = [
  "Maria",
  "Mary Grace",
  "Mary Ann",
  "Mary Joy",
  "Ana",
  "Joan",
  "Jessa",
  "Jonalyn",
  "Rosemarie",
  "Aira",
  "Angelica",
  "Shiela",
  "Charmaine",
  "Lovely",
  "Hazel",
  "Rochelle",
  "Jenny",
  "Jocelyn",
  "Maricel",
  "Liza",
  "John Paul",
  "Mark Anthony",
  "Jerome",
  "Carlo",
  "Ryan",
  "Rodel",
  "Michael",
  "Kevin",
  "Paolo",
  "Christian",
  "Reynaldo",
  "Jefferson",
  "Alvin",
  "Noel",
  "Renato",
  "Junrey",
  "Arnel",
  "Jomar",
  "Christopher",
  "Kenneth",
  "Vanessa",
  "Rica Mae",
  "Kimberly",
  "Lea",
  "Michelle",
  "April Mae",
  "Christine",
  "Catherine",
  "Janine",
  "Melanie",
  "Francis",
  "Marvin",
  "Roel",
  "Dexter",
  "Nestor",
  "Gilbert",
  "Arnold",
  "Leo",
  "Monica",
  "Rowena",
];

const FAMILY_NAMES = [
  "Dela Cruz",
  "Santos",
  "Reyes",
  "Garcia",
  "Mendoza",
  "Bautista",
  "Ramos",
  "Flores",
  "Gonzales",
  "Villanueva",
  "Fernandez",
  "Torres",
  "Rivera",
  "Aquino",
  "Castro",
  "Navarro",
  "Romero",
  "Morales",
  "Salazar",
  "Domingo",
  "Mercado",
  "Pascual",
  "Abad",
  "Lim",
  "Uy",
  "Tan",
  "Tiu",
  "Labrador",
  "Mirasol",
  "Cadiz",
  "Pepito",
  "Valencia",
  "Limson",
  "Paculba",
  "Maningo",
  "Ligan",
  "Ybañez",
  "Lacson",
  "Alcantara",
  "Lloren",
  "Cabrera",
  "Ong",
  "Abarquez",
  "Padernal",
  "Bacus",
  "Mabilog",
  "Arriola",
  "Rosales",
  "Velez",
  "Cabahug",
];

const GENERIC_BARANGAYS = [
  "Poblacion",
  "Poblacion Norte",
  "Poblacion Sur",
  "San Isidro",
  "San Roque",
  "San Vicente",
  "Santa Cruz",
  "Santa Maria",
  "Santo Niño",
  "San Antonio",
  "San Juan",
  "San Pedro",
  "Sampaguita",
];

const GENERIC_STREETS = [
  "Rizal Street",
  "Mabini Street",
  "Bonifacio Street",
  "Quezon Avenue",
  "Roxas Street",
  "Del Rosario Street",
  "Osmeña Street",
  "Lapu-Lapu Street",
];

const LOCALITY_PROFILES = {
  "tagbilaran city|bohol": {
    barangays: ["Cogon", "Dao", "Manga", "Taloto", "Mansasa", "Booy", "Bool", "Ubujan", "Dampas", "Tiptip", "Poblacion I", "Poblacion II"],
    streets: ["C.P.G. Avenue", "Rajah Sikatuna Avenue", "Gallares Street", "J.A. Clarin Street", "Calceta Street", "Graham Avenue", "Palma Street", "Carlos P. Garcia North Avenue"],
  },
  "ubay|bohol": {
    barangays: ["Poblacion", "Bood", "Camambugan", "Fatima", "Biabas", "Achila", "Hambabauran", "San Pascual", "Tapon", "Imelda"],
    streets: ["National Highway", "Bood Road", "Camambugan Road", "Poblacion Road", "Mabini Street", "Rizal Street", "Seaside Road", "San Pascual Road"],
  },
  "tubigon|bohol": {
    barangays: ["Poblacion", "Pooc Occidental", "Pooc Oriental", "Macaas", "Panadtaran", "Pinayagan Norte", "Pinayagan Sur", "Potohan", "Talenceras", "Centro"],
    streets: ["National Road", "Macaas Road", "Pooc Road", "Rizal Street", "Bonifacio Street", "Tubigon Port Road", "Poblacion Highway", "Talenceras Road"],
  },
  "cebu city|cebu": {
    barangays: ["Lahug", "Mabolo", "Guadalupe", "Capitol Site", "Talamban", "Banilad", "Labangon", "Kasambagan", "Punta Princesa", "Tisa"],
    streets: ["Osmeña Boulevard", "Escario Street", "Gov. Cuenco Avenue", "Gorordo Avenue", "F. Ramos Street", "V. Rama Avenue", "Tres de Abril Street", "Colon Street"],
  },
  "mandaue city|cebu": {
    barangays: ["Centro", "Subangdaku", "Tipolo", "Bakilid", "Alang-Alang", "Jagobiao", "Cabancalan", "Ibabao", "Guizo", "Looc"],
    streets: ["A.S. Fortuna Street", "M.C. Briones Street", "Hernan Cortes Street", "Plaridel Street", "U.N. Avenue", "Mantawi Avenue", "Ouano Avenue", "P. Remedio Street"],
  },
};

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function buildLocalityKey(municipalityName, provinceName) {
  return `${String(municipalityName ?? "").trim().toLowerCase()}|${String(provinceName ?? "").trim().toLowerCase()}`;
}

function pick(list, seed) {
  return list[Math.abs(seed) % list.length];
}

function buildBorrowerIdentity(area, areaIndex, slot) {
  const seed = (areaIndex + 1) * 131 + slot * 17 + area.area_id;
  const firstName = pick(FIRST_NAMES, seed);
  const lastName = pick(FAMILY_NAMES, seed * 7 + 11);
  const shouldHaveMiddleName = seed % 4 !== 0;
  const middleName = shouldHaveMiddleName ? pick(FAMILY_NAMES, seed * 13 + 5) : null;

  return {
    firstName,
    middleName,
    lastName,
  };
}

function buildBorrowerAddress(area, areaIndex, slot) {
  const seed = (areaIndex + 1) * 197 + slot * 23 + area.area_id;
  const localityKey = buildLocalityKey(area.municipality_name, area.province_name);
  const profile = LOCALITY_PROFILES[localityKey] ?? {
    barangays: GENERIC_BARANGAYS,
    streets: GENERIC_STREETS,
  };

  const barangay = pick(profile.barangays, seed);
  const street = pick(profile.streets, seed * 5 + 3);
  const houseNo = (seed % 180) + 8;
  const blockNo = ((seed * 3) % 18) + 1;
  const lotNo = ((seed * 5) % 24) + 1;
  const purokNo = (seed % 7) + 1;
  const sitioName = pick(
    ["Sampaguita", "Mahogany", "Malipayon", "Lumbay", "Mahayag", "Paglaum", "Matin-ao", "Camia"],
    seed * 11 + 9,
  );
  const template = seed % 4;

  if (template === 0) {
    return `Purok ${purokNo}, ${street}, ${barangay}, ${area.municipality_name}, ${area.province_name}`;
  }

  if (template === 1) {
    return `House ${houseNo}, ${street}, ${barangay}, ${area.municipality_name}, ${area.province_name}`;
  }

  if (template === 2) {
    return `Lot ${lotNo}, Block ${blockNo}, ${street}, ${barangay}, ${area.municipality_name}, ${area.province_name}`;
  }

  return `Sitio ${sitioName}, ${barangay}, ${area.municipality_name}, ${area.province_name}`;
}

function buildDesiredCompanyId(areaCode, slot) {
  return `${areaCode}-${String(slot).padStart(4, "0")}`;
}

function normalizeNamePart(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function buildEmailBase(identity) {
  const firstName = normalizeNamePart(identity.firstName);
  const middleName = normalizeNamePart(identity.middleName);
  const lastName = normalizeNamePart(identity.lastName);
  const firstSegment = firstName || middleName || "borrower";
  const lastSegment = lastName || "account";
  return `${firstSegment}${lastSegment}`;
}

function generateUniqueEmail(identity, usedEmails, seed) {
  const base = buildEmailBase(identity);
  let attempt = 0;

  while (attempt < 500) {
    const domain = EMAIL_DOMAINS[(seed + attempt) % EMAIL_DOMAINS.length];
    const suffix = attempt === 0 ? "" : String(attempt + 1);
    const candidate = `${base}${suffix}@${domain}`;

    if (!usedEmails.has(candidate)) {
      usedEmails.add(candidate);
      return candidate;
    }

    attempt += 1;
  }

  throw new Error(`Unable to generate a unique email for ${identity.firstName} ${identity.lastName}.`);
}

function generateUniqueContactNo(usedContactNos) {
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

  throw new Error(`Unable to generate a unique contact number for area ${areaIndex + 1}, slot ${slot}.`);
}

async function deleteAuthUserSafely(adminClient, userId) {
  try {
    await adminClient.auth.admin.deleteUser(userId);
  } catch {
    // Best-effort cleanup only.
  }
}

async function provisionBorrowerAuth(adminClient) {
  const provisionalEmail = `pending-${randomUUID()}@${INTERNAL_AUTH_DOMAIN}`;
  const { data: createdAuthData, error: createError } = await adminClient.auth.admin.createUser({
    email: provisionalEmail,
    password: DEFAULT_SEED_PASSWORD,
    email_confirm: true,
  });

  if (createError || !createdAuthData.user?.id) {
    throw new Error(`Unable to create auth user: ${createError?.message ?? "Unknown error."}`);
  }

  const userId = createdAuthData.user.id;
  const internalEmail = `${userId}@${INTERNAL_AUTH_DOMAIN}`;
  const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
    email: internalEmail,
    email_confirm: true,
  });

  if (updateError) {
    await deleteAuthUserSafely(adminClient, userId);
    throw new Error(`Auth user created, but internal email update failed: ${updateError.message}`);
  }

  return { userId, internalEmail };
}

function printAreaSummary(area, summary) {
  console.log(
    `[${area.area_code}] ${area.branch_name}: created=${summary.created}, existing=${summary.existing}, collisions=${summary.collisions}, failures=${summary.failures}`,
  );
}

async function main() {
  const databaseUrl = requireEnv("DATABASE_URL");
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const sql = postgres(databaseUrl, { prepare: false });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let fatalError = null;

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

    const areaRows = await sql`
      select
        a.area_id,
        a.area_code,
        a.area_no,
        a.branch_id,
        b.branch_name,
        b.branch_code,
        b.municipality_name,
        b.province_name
      from areas a
      inner join branch b on b.branch_id = a.branch_id
      where a.status = 'active'
        and b.status = 'active'
      order by b.branch_name asc, a.area_code asc
    `;

    if (areaRows.length === 0) {
      throw new Error("No active areas were found. Borrower seed cannot continue.");
    }

    const existingRows = await sql`
      select
        u.user_id,
        u.company_id,
        u.username,
        u.email,
        u.contact_no,
        bi.area_id
      from users u
      left join borrower_info bi on bi.user_id = u.user_id
    `;

    const usedCompanyIds = new Set();
    const usedUsernames = new Set();
    const usedEmails = new Set();
    const usedContactNos = new Set();
    const borrowersByAreaAndCompanyId = new Map();

    for (const row of existingRows) {
      usedCompanyIds.add(row.company_id);
      usedUsernames.add(row.username);
      if (row.email) {
        usedEmails.add(String(row.email).toLowerCase());
      }
      if (row.contact_no) {
        usedContactNos.add(row.contact_no);
      }

      if (row.area_id !== null) {
        const areaMap = borrowersByAreaAndCompanyId.get(row.area_id) ?? new Map();
        areaMap.set(row.company_id, row);
        borrowersByAreaAndCompanyId.set(row.area_id, areaMap);
      }
    }

    console.log(`Borrower role id: ${borrowerRoleId}`);
    console.log(`Active areas discovered: ${areaRows.length}`);
    const expectedAreas = 25;
    const expectedTotalBorrowers = expectedAreas * BORROWERS_PER_AREA;
    if (areaRows.length !== expectedAreas) {
      console.warn(
        `Expected ${expectedAreas} active areas for a full ${expectedTotalBorrowers}-borrower seed, but found ${areaRows.length}.`,
      );
    }
    console.log(`Seed password source: BORROWER_SEED_PASSWORD ${process.env.BORROWER_SEED_PASSWORD ? "(from env)" : "(default fallback)"}`);

    const totals = {
      created: 0,
      existing: 0,
      collisions: 0,
      failures: 0,
    };

    for (let areaIndex = 0; areaIndex < areaRows.length; areaIndex += 1) {
      const area = areaRows[areaIndex];
      const areaSummary = {
        created: 0,
        existing: 0,
        collisions: 0,
        failures: 0,
      };

      for (let slot = 1; slot <= BORROWERS_PER_AREA; slot += 1) {
        const desiredCompanyId = buildDesiredCompanyId(area.area_code, slot);
        const existingBorrowerInArea = borrowersByAreaAndCompanyId.get(area.area_id)?.get(desiredCompanyId) ?? null;

        if (existingBorrowerInArea) {
          areaSummary.existing += 1;
          totals.existing += 1;
          continue;
        }

        if (usedCompanyIds.has(desiredCompanyId) || usedUsernames.has(desiredCompanyId)) {
          console.warn(`[collision] ${desiredCompanyId} already exists outside the expected borrower slot in area ${area.area_code}. Skipping.`);
          areaSummary.collisions += 1;
          totals.collisions += 1;
          continue;
        }

        const identity = buildBorrowerIdentity(area, areaIndex, slot);
        const address = buildBorrowerAddress(area, areaIndex, slot);
        const contactNo = generateUniqueContactNo(usedContactNos);
        const borrowerEmail = generateUniqueEmail(identity, usedEmails, areaIndex * BORROWERS_PER_AREA + slot);

        let provisionedAuth = null;

        try {
          provisionedAuth = await provisionBorrowerAuth(adminClient);
          const updatedAt = new Date().toISOString();

          await sql.begin(async (tx) => {
            await tx`
              insert into users (
                user_id,
                company_id,
                username,
                role_id,
                contact_no,
                email,
                status,
                created_by,
                updated_at
              ) values (
                ${provisionedAuth.userId},
                ${desiredCompanyId},
                ${desiredCompanyId},
                ${borrowerRoleId},
                ${contactNo},
                ${borrowerEmail},
                'active',
                ${SEED_CREATED_BY_USER_ID},
                ${updatedAt}
              )
            `;

            await tx`
              insert into borrower_info (
                user_id,
                first_name,
                middle_name,
                last_name,
                address,
                area_id
              ) values (
                ${provisionedAuth.userId},
                ${identity.firstName},
                ${identity.middleName},
                ${identity.lastName},
                ${address},
                ${area.area_id}
              )
            `;
          });

          usedCompanyIds.add(desiredCompanyId);
          usedUsernames.add(desiredCompanyId);
          const areaMap = borrowersByAreaAndCompanyId.get(area.area_id) ?? new Map();
          areaMap.set(desiredCompanyId, {
            user_id: provisionedAuth.userId,
            company_id: desiredCompanyId,
            username: desiredCompanyId,
            contact_no: contactNo,
            area_id: area.area_id,
          });
          borrowersByAreaAndCompanyId.set(area.area_id, areaMap);

          areaSummary.created += 1;
          totals.created += 1;
        } catch (error) {
          if (provisionedAuth?.userId) {
            await deleteAuthUserSafely(adminClient, provisionedAuth.userId);
          }

          areaSummary.failures += 1;
          totals.failures += 1;
          console.error(`[failed] ${desiredCompanyId}: ${error instanceof Error ? error.message : "Unknown error."}`);
        }
      }

      printAreaSummary(area, areaSummary);
    }

    console.log("");
    console.log("Borrower seed summary");
    console.log(`Created: ${totals.created}`);
    console.log(`Existing desired slots skipped: ${totals.existing}`);
    console.log(`Collisions skipped: ${totals.collisions}`);
    console.log(`Failures: ${totals.failures}`);
    console.log(`Target per area: ${BORROWERS_PER_AREA}`);
    console.log(`Total target if ${expectedAreas} areas exist: ${expectedAreas * BORROWERS_PER_AREA}`);

    if (totals.failures > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    fatalError = error instanceof Error ? error : new Error("Unknown fatal borrower seed error.");
    console.error(fatalError.message);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main();
