"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type IncentivesWorkspaceTransitionContextValue = {
  isPending: boolean;
  setPending: (value: boolean) => void;
};

const IncentivesWorkspaceTransitionContext =
  createContext<IncentivesWorkspaceTransitionContextValue | null>(null);

export function IncentivesWorkspaceTransitionProvider(props: { children: ReactNode }) {
  const [isPending, setPending] = useState(false);
  const value = useMemo(() => ({ isPending, setPending }), [isPending]);

  return (
    <IncentivesWorkspaceTransitionContext.Provider value={value}>
      {props.children}
    </IncentivesWorkspaceTransitionContext.Provider>
  );
}

export function useIncentivesWorkspaceTransition() {
  const value = useContext(IncentivesWorkspaceTransitionContext);

  if (!value) {
    throw new Error("useIncentivesWorkspaceTransition must be used within its provider.");
  }

  return value;
}

export function IncentivesWorkspaceTransitionSurface(props: { children: ReactNode }) {
  const { isPending } = useIncentivesWorkspaceTransition();

  return (
    <div className="relative">
      <div className={isPending ? "pointer-events-none select-none blur-[1px]" : undefined}>{props.children}</div>
      {isPending ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/65 backdrop-blur-[1px]">
          <div className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm">
            Updating incentives...
          </div>
        </div>
      ) : null}
    </div>
  );
}
