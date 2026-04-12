"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BorrowerListRow } from "@/app/dashboard/borrowers/types";
import {
  UI_TABLE_HEADER_ROW_CLASS_NAME,
  UI_TABLE_WRAPPER_CLASS_NAME,
  UI_TABLE_ROW_HOVER_CLASS_NAME,
} from "@/app/dashboard/_components/ui-patterns";

function formatNameList(firstName: string | null, middleName: string | null, lastName: string | null) {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();
  const middle = (middleName ?? "").trim();
  const middleInitial = middle ? `${middle[0].toUpperCase()}.` : "";
  const left = [first, middleInitial, last].filter(Boolean).join(" ");

  return left || "N/A";
}

export function BorrowersTable({ borrowers }: { borrowers: BorrowerListRow[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const returnTo = query ? `${pathname}?${query}` : pathname;

  if (borrowers.length === 0) {
    return (
      <div className={UI_TABLE_WRAPPER_CLASS_NAME}>
        <Table className="min-w-[980px] text-sm">
          <TableBody>
            <TableRow>
              <TableCell className="py-10 text-center text-sm text-muted-foreground" colSpan={6}>
                No borrowers found for the selected filter.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className={UI_TABLE_WRAPPER_CLASS_NAME}>
      <Table className="min-w-[980px] text-sm">
        <TableHeader>
          <TableRow className={UI_TABLE_HEADER_ROW_CLASS_NAME}>
            <TableHead className="h-auto py-3 pl-5">Name</TableHead>
            <TableHead className="h-auto py-3">Company ID</TableHead>
            <TableHead className="h-auto py-3">Branch / Area</TableHead>
            <TableHead className="h-auto py-3">Contact</TableHead>
            <TableHead className="h-auto py-3">Email</TableHead>
            <TableHead className="h-auto py-3">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {borrowers.map((row) => (
            <TableRow className={UI_TABLE_ROW_HOVER_CLASS_NAME} key={row.userId}>
              <TableCell className="py-3 pl-5 font-medium">
                {formatNameList(row.firstName, row.middleName, row.lastName)}
              </TableCell>
              <TableCell className="py-3">{row.companyId}</TableCell>
              <TableCell className="py-3">{`${row.branchName}-${row.areaNo}`}</TableCell>
              <TableCell className="py-3 text-muted-foreground">{row.contactNumber || "N/A"}</TableCell>
              <TableCell className="py-3 text-muted-foreground">{row.email || "N/A"}</TableCell>
              <TableCell className="py-3">
                <Link href={`/dashboard/borrowers/${row.userId}?source=borrowers&returnTo=${encodeURIComponent(returnTo)}`}>
                  <Button className="h-11 rounded-md px-4" type="button" variant="outline">
                    View
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
