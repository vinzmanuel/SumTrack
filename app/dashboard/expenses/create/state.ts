export type CreateExpenseState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: {
    expense_category?: string;
    description?: string;
    amount?: string;
    expense_date?: string;
  };
  result?: {
    expenseId: string;
    branchName: string;
    expenseCategory: string;
    description: string;
    amount: number;
    expenseDate: string;
  };
};

export const initialCreateExpenseState: CreateExpenseState = {
  status: "idle",
};
