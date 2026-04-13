import { UserStar } from "lucide-react";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
import { CollectorsResultsSkeleton } from "@/app/dashboard/collectors/collectors-results-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UI_CONTROL_CLASS_NAME,
  UI_FILTER_CONTROLS_CLASS_NAME,
  UI_FILTER_ROW_CLASS_NAME,
  UI_PAGE_STACK_CLASS_NAME,
  UI_SEARCH_CONTAINER_CLASS_NAME,
} from "@/app/dashboard/_components/ui-patterns";

export default function LoadingCollectorsPage() {
  return (
    <>
      <DashboardHeaderConfigurator
        config={{
          description:
            "Compare collector performance across your visible branches with period-based ranking and focused summaries.",
          icon: <UserStar className="size-9 text-sidebar-foreground/65" />,
          title: "Collectors",
        }}
      />
      <div className={UI_PAGE_STACK_CLASS_NAME}>
        <div className={UI_FILTER_ROW_CLASS_NAME}>
          <div className={UI_SEARCH_CONTAINER_CLASS_NAME}>
            <Skeleton className={`${UI_CONTROL_CLASS_NAME} w-full`} />
          </div>
          <div className={UI_FILTER_CONTROLS_CLASS_NAME}>
            <Skeleton className={`${UI_CONTROL_CLASS_NAME} w-full min-w-[180px] sm:w-[190px]`} />
            <Skeleton className={`${UI_CONTROL_CLASS_NAME} w-full min-w-[180px] sm:w-[190px]`} />
            <Skeleton className={`${UI_CONTROL_CLASS_NAME} w-[96px]`} />
          </div>
        </div>
        <CollectorsResultsSkeleton />
      </div>
    </>
  );
}
