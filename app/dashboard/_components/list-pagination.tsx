import Link from "next/link";
import { Button } from "@/components/ui/button";

type ListPaginationProps = {
  pathname: string;
  currentPage: number;
  pageSize: number;
  totalCount: number;
  query: Record<string, string | undefined>;
};

function buildHref(
  pathname: string,
  query: Record<string, string | undefined>,
  page: number,
) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  if (page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export function ListPagination({
  pathname,
  currentPage,
  pageSize,
  totalCount,
  query,
}: ListPaginationProps) {
  const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1);
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const showingFrom = totalCount === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const showingTo = totalCount === 0 ? 0 : Math.min(safeCurrentPage * pageSize, totalCount);

  return (
    <div className="flex flex-col gap-3 border-t pt-4 text-sm md:flex-row md:items-center md:justify-between">
      <p className="text-muted-foreground">
        Showing {showingFrom}-{showingTo} of {totalCount}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">
          Page {safeCurrentPage} of {totalPages}
        </span>
        <Link
          aria-disabled={safeCurrentPage <= 1}
          href={buildHref(pathname, query, Math.max(safeCurrentPage - 1, 1))}
          tabIndex={safeCurrentPage <= 1 ? -1 : undefined}
        >
          <Button disabled={safeCurrentPage <= 1} size="sm" type="button" variant="outline">
            Previous
          </Button>
        </Link>
        <Link
          aria-disabled={safeCurrentPage >= totalPages}
          href={buildHref(pathname, query, Math.min(safeCurrentPage + 1, totalPages))}
          tabIndex={safeCurrentPage >= totalPages ? -1 : undefined}
        >
          <Button disabled={safeCurrentPage >= totalPages} size="sm" type="button" variant="outline">
            Next
          </Button>
        </Link>
      </div>
    </div>
  );
}
