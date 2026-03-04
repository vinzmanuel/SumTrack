export type FinalizeIncentiveState = {
  status: "idle" | "error" | "success";
  message?: string;
};

export const initialFinalizeIncentiveState: FinalizeIncentiveState = {
  status: "idle",
};
