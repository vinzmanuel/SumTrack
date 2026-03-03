export type IncentiveRuleFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: {
    branch_id?: string;
    role_id?: string;
    percent_value?: string;
    flat_amount?: string;
  };
  result?: {
    mode: "created" | "updated";
    branchName: string;
    roleName: string;
    percentValue: number;
    flatAmount: number;
  };
};

export const initialIncentiveRuleFormState: IncentiveRuleFormState = {
  status: "idle",
};
