export type CreateLoanState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: {
    borrower_id?: string;
    branch_id?: string;
    area_id?: string;
    principal?: string;
    interest?: string;
    start_date?: string;
    due_date?: string;
  };
  result?: {
    loanId: string;
    loanCode: string;
    borrowerName: string;
    branchName: string;
    principal: number;
    interest: number;
    startDate: string;
    dueDate: string;
    status: string;
  };
};

export const initialCreateLoanState: CreateLoanState = {
  status: "idle",
};
