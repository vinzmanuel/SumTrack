export type CreateAccountState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: {
    account_category?: string;
    role_id?: string;
    first_name?: string;
    last_name?: string;
    contact_number?: string;
    address?: string;
    branch_id?: string;
    branch_ids?: string;
  };
  result?: {
    accountCategory: "Employee" | "Borrower";
    fullName: string;
    username: string;
    role: string;
    userId: string;
    temporaryPassword: string;
    assignedBranches: string[];
    contactNumber?: string;
    address?: string;
  };
};

export const initialCreateAccountState: CreateAccountState = {
  status: "idle",
};
