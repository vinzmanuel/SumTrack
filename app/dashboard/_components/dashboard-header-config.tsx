"use client";

import { createContext, useContext, useEffect } from "react";
import type { ReactNode } from "react";

export type DashboardHeaderConfig = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
};

const DashboardHeaderConfigContext = createContext<
  ((config: DashboardHeaderConfig | null) => void) | null
>(null);

export function DashboardHeaderConfigProvider({
  children,
  setConfig,
}: {
  children: ReactNode;
  setConfig: (config: DashboardHeaderConfig | null) => void;
}) {
  return (
    <DashboardHeaderConfigContext.Provider value={setConfig}>
      {children}
    </DashboardHeaderConfigContext.Provider>
  );
}

export function DashboardHeaderConfigurator({
  config,
}: {
  config: DashboardHeaderConfig;
}) {
  const setConfig = useContext(DashboardHeaderConfigContext);

  useEffect(() => {
    setConfig?.(config);

    return () => {
      setConfig?.(null);
    };
  }, [config, setConfig]);

  return null;
}

export function useDashboardHeaderConfig() {
  const setConfig = useContext(DashboardHeaderConfigContext);

  if (!setConfig) {
    throw new Error("useDashboardHeaderConfig must be used within DashboardHeaderConfigProvider.");
  }

  return setConfig;
}
