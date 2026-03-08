import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { BorrowerListRow } from "@/app/dashboard/borrowers/types";

function formatNameList(lastName: string | null, firstName: string | null, middleName: string | null) {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();
  const middle = (middleName ?? "").trim();
  const middleInitial = middle ? `${middle[0].toUpperCase()}.` : "";
  const right = [first, middleInitial].filter(Boolean).join(" ");

  if (last && right) {
    return `${last}, ${right}`;
  }

  return last || right || "N/A";
}

export function BorrowersTable({ borrowers }: { borrowers: BorrowerListRow[] }) {
  if (borrowers.length === 0) {
    return <p className="text-muted-foreground text-sm">No borrowers found for the selected filter.</p>;
  }

  return (
    <div className="overflow-auto">
      <table className="w-full min-w-260 text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="px-2 py-2 font-medium">Company ID</th>
            <th className="px-2 py-2 font-medium">Name</th>
            <th className="px-2 py-2 font-medium">Area</th>
            <th className="px-2 py-2 font-medium">Branch</th>
            <th className="px-2 py-2 font-medium">Contact</th>
            <th className="px-2 py-2 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {borrowers.map((row) => (
            <tr className="border-b" key={row.userId}>
              <td className="px-2 py-2">{row.companyId}</td>
              <td className="px-2 py-2">{formatNameList(row.lastName, row.firstName, row.middleName)}</td>
              <td className="px-2 py-2">{row.areaCode}</td>
              <td className="px-2 py-2">{row.branchCode || row.branchName}</td>
              <td className="px-2 py-2">{row.contactNumber || "N/A"}</td>
              <td className="px-2 py-2">
                <Link href={`/dashboard/borrowers/${row.userId}`}>
                  <Button size="sm" type="button" variant="outline">
                    View
                  </Button>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
