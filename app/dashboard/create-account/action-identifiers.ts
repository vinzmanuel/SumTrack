import { randomInt, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createAdminClient } from "@/lib/supabase/admin";
import { db } from "@/db";
import { borrower_info, users } from "@/db/schema";
import type { CreateAccountResolution, ProvisionedAuthAccount } from "@/app/dashboard/create-account/action-types";
import { createErrorState } from "@/app/dashboard/create-account/action-validation";

export function generateTemporaryPassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*_-+=";
  const allChars = `${upper}${lower}${digits}${symbols}`;

  const required = [
    upper[randomInt(upper.length)],
    lower[randomInt(lower.length)],
    digits[randomInt(digits.length)],
    symbols[randomInt(symbols.length)],
  ];

  const remainingLength = 14 - required.length;
  const remaining = Array.from({ length: remainingLength }, () => allChars[randomInt(allChars.length)]);
  const mixed = [...required, ...remaining];

  for (let index = mixed.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [mixed[index], mixed[swapIndex]] = [mixed[swapIndex], mixed[index]];
  }

  return mixed.join("");
}

export async function deleteAuthUserSafely(userId: string) {
  try {
    const adminClient = createAdminClient();
    await adminClient.auth.admin.deleteUser(userId);
  } catch {
    // Best-effort rollback only.
  }
}

export async function generateNextEmployeeCompanyId() {
  const companyRows = await db.select({ company_id: users.company_id }).from(users);
  const maxNumeric = companyRows.reduce((currentMax, row) => {
    if (!/^\d+$/.test(row.company_id)) {
      return currentMax;
    }
    const parsed = Number(row.company_id);
    return Number.isFinite(parsed) ? Math.max(currentMax, parsed) : currentMax;
  }, 0);

  return String(maxNumeric + 1).padStart(6, "0");
}

export async function generateNextBorrowerCompanyId(areaId: number, areaCode: string) {
  const rows = await db
    .select({
      company_id: users.company_id,
    })
    .from(borrower_info)
    .innerJoin(users, eq(users.user_id, borrower_info.user_id))
    .where(eq(borrower_info.area_id, areaId));

  const escapedAreaCode = areaCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const suffixPattern = new RegExp(`^${escapedAreaCode}-(\\d{4})$`);

  let maxSuffix = 0;
  for (const row of rows) {
    const match = row.company_id.match(suffixPattern);
    if (!match) {
      continue;
    }
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed)) {
      maxSuffix = Math.max(maxSuffix, parsed);
    }
  }

  const nextSuffix = String(maxSuffix + 1).padStart(4, "0");
  return `${areaCode}-${nextSuffix}`;
}

export async function provisionAuthAccount(): Promise<CreateAccountResolution<ProvisionedAuthAccount>> {
  const temporaryPassword = generateTemporaryPassword();
  const adminClient = createAdminClient();
  const provisionalEmail = `pending-${randomUUID()}@sumtrack.local`;

  const { data: createdAuthData, error: createAuthError } = await adminClient.auth.admin.createUser({
    email: provisionalEmail,
    password: temporaryPassword,
    email_confirm: true,
  });

  if (createAuthError || !createdAuthData.user?.id) {
    return {
      ok: false,
      state: createErrorState(
        `Unable to create auth account: ${createAuthError?.message ?? "Unknown error."}`,
      ),
    };
  }

  const createdUserId = createdAuthData.user.id;
  const internalEmail = `${createdUserId}@sumtrack.local`;

  const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(createdUserId, {
    email: internalEmail,
    email_confirm: true,
  });

  if (updateAuthError) {
    await deleteAuthUserSafely(createdUserId);
    return {
      ok: false,
      state: createErrorState(
        `Auth user was created, but setting internal email failed: ${updateAuthError.message}`,
      ),
    };
  }

  return {
    ok: true,
    data: {
      userId: createdUserId,
      temporaryPassword,
    },
  };
}
