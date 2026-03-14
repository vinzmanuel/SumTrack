import type { BorrowerDetailTabKey } from "@/app/dashboard/borrowers/types";

export function parseBorrowerDetailTab(value: string | undefined): BorrowerDetailTabKey {
  if (value === "loan-history" || value === "documents") {
    return value;
  }

  return "profile";
}
