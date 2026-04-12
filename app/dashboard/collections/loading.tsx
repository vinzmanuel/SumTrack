import { Skeleton } from "@/components/ui/skeleton";
import {
  UI_CONTROL_CLASS_NAME,
  UI_FILTER_CONTROLS_NO_SEARCH_CLASS_NAME,
  UI_FILTER_ROW_CLASS_NAME,
  UI_PAGE_STACK_CLASS_NAME,
} from "@/app/dashboard/_components/ui-patterns";
import { CollectionsResultsSkeleton } from "@/app/dashboard/collections/collections-results-skeleton";

export default function LoadingCollectionsPage() {
  return (
    <div className={UI_PAGE_STACK_CLASS_NAME}>
      <div className={UI_FILTER_ROW_CLASS_NAME}>
        <div className={UI_FILTER_CONTROLS_NO_SEARCH_CLASS_NAME}>
          <Skeleton className={`${UI_CONTROL_CLASS_NAME} w-full min-w-[180px] sm:w-[190px]`} />
          <Skeleton className={`${UI_CONTROL_CLASS_NAME} w-full min-w-[180px] sm:w-[190px]`} />
          <Skeleton className={`${UI_CONTROL_CLASS_NAME} w-[96px]`} />
        </div>
      </div>
      <CollectionsResultsSkeleton />
    </div>
  );
}
