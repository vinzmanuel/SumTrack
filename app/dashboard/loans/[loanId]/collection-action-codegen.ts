import { eq } from "drizzle-orm";
import { db } from "@/db";
import { collections } from "@/db/schema";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function generateNextCollectionCode(loanId: number, loanCode: string) {
  const existingCollectionCodes = await db
    .select({ collection_code: collections.collection_code })
    .from(collections)
    .where(eq(collections.loan_id, loanId));

  const pattern = new RegExp(`^${escapeRegExp(loanCode)}-C(\\d{3})$`);
  let maxSequence = 0;

  for (const row of existingCollectionCodes) {
    const match = row.collection_code.match(pattern);
    if (!match) {
      continue;
    }

    const parsed = Number(match[1]);
    if (Number.isFinite(parsed)) {
      maxSequence = Math.max(maxSequence, parsed);
    }
  }

  const nextSequence = String(maxSequence + 1).padStart(3, "0");
  return `${loanCode}-C${nextSequence}`;
}
