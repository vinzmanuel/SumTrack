import { User } from "lucide-react";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
import {
  UI_SURFACE_CLASS_NAME,
  UI_TAB_ICON_ACTIVE_CLASS_NAME,
  UI_TAB_LIST_CLASS_NAME,
  UI_TAB_SEPARATOR_CLASS_NAME,
  getUiTabTriggerClassName,
} from "@/app/dashboard/_components/ui-patterns";
import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingBorrowerProfilePage() {
  return (
    <>
      <DashboardHeaderConfigurator
        config={{
          breadcrumbTitle: "Loading borrower...",
          description: "Review borrower account details, loan history, and operational documents within your allowed scope.",
          icon: <User className="size-9 text-sidebar-foreground/65" />,
          title: "Borrower Details",
        }}
      />
      <div className="space-y-4">
        <section className={`${UI_SURFACE_CLASS_NAME} overflow-hidden`}>
          <div className="p-5 md:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-72 rounded-md" />
                    <Skeleton className="h-6 w-20 rounded-md" />
                  </div>
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-40 rounded-md" />
                    <Skeleton className="h-4 w-24 rounded-md" />
                    <Skeleton className="h-4 w-64 rounded-md" />
                  </div>
                </div>
              </div>

              <Skeleton className="h-11 w-32 rounded-md" />
            </div>
          </div>
        </section>

        <section className={UI_TAB_SEPARATOR_CLASS_NAME}>
          <div className={UI_TAB_LIST_CLASS_NAME}>
            <div className={getUiTabTriggerClassName(true)}>
              <User className={UI_TAB_ICON_ACTIVE_CLASS_NAME} />
              Profile
            </div>
            <div className={getUiTabTriggerClassName(false)}>Loan History</div>
            <div className={getUiTabTriggerClassName(false)}>Documents</div>
          </div>
        </section>

        <section className={`${UI_SURFACE_CLASS_NAME} p-5 md:p-6`}>
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-28 rounded-md" />
            <Skeleton className="h-28 rounded-md" />
            <Skeleton className="h-28 rounded-md" />
            <Skeleton className="h-28 rounded-md" />
          </div>
        </section>

        <section className={`${UI_SURFACE_CLASS_NAME} p-5 md:p-6`}>
          <div className="space-y-3">
            <Skeleton className="h-5 w-44 rounded-md" />
            <Skeleton className="h-20 rounded-md" />
            <Skeleton className="h-20 rounded-md" />
          </div>
        </section>
      </div>
    </>
  );
}
