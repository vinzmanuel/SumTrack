import type { DashboardAuthContext } from "@/app/dashboard/auth";

export type BorrowersPageProps = {
  searchParams?: Promise<{
    branchId?: string;
    areaId?: string;
  }>;
};

export type BorrowersListFilters = {
  requestedBranchId: number | null;
  requestedAreaId: number | null;
};

export type BorrowerBranchOption = {
  branch_id: number;
  branch_name: string;
};

export type BorrowerAreaOption = {
  area_id: number;
  area_code: string;
};

export type BorrowerListRow = {
  userId: string;
  companyId: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  areaCode: string;
  branchName: string;
  branchCode: string | null;
  contactNumber: string | null;
};

export type BorrowersStaffScope = {
  view: "staff";
  roleName: DashboardAuthContext["roleName"];
  selectedBranchId: number | null;
  requestedAreaId: number | null;
  allowedBranchIds: number[];
  canChooseBranch: boolean;
  allBranchLabel: string;
  scopeMessage: string;
};

export type BorrowersAccessState =
  | BorrowersStaffScope
  | {
      view: "unauthenticated";
      message: string;
    }
  | {
      view: "forbidden";
      message: string;
    }
  | {
      view: "scope_error";
      message: string;
    };

export type BorrowersPageData = {
  branches: BorrowerBranchOption[];
  areas: BorrowerAreaOption[];
  borrowers: BorrowerListRow[];
  selectedAreaId: number | null;
};
