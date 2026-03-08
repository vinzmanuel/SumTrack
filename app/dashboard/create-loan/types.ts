export type CreateLoanPageProps = {
  searchParams?: Promise<{
    borrowerId?: string;
  }>;
};

export type BranchOption = {
  branch_id: string | number;
  branch_name: string;
};

export type AreaOption = {
  area_id: string | number;
  branch_id: string | number;
  area_no: string;
  area_code: string;
};

export type CollectorOption = {
  user_id: string;
  area_id: string | number;
  label: string;
};

export type BorrowerOption = {
  user_id: string;
  area_id: string | number;
  company_id: string | null;
  label: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
};

export type PrefilledBorrower = {
  borrowerId: string;
  branchId: string;
  areaId: string;
  label: string;
};

export type CreateLoanReadyState = {
  status: "ready";
  isAdmin: boolean;
  branches: BranchOption[];
  areas: AreaOption[];
  borrowers: BorrowerOption[];
  collectors: CollectorOption[];
  activeLoanBorrowerIds: string[];
  prefilledBorrower: PrefilledBorrower | null;
};

export type CreateLoanPageState =
  | CreateLoanReadyState
  | {
      status: "not_logged_in";
    }
  | {
      status: "forbidden";
    }
  | {
      status: "branch_assignment_required";
    };
