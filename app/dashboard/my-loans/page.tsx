import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { parseBorrowerLoansFilters } from "@/app/dashboard/my-loans/filters";
import { MyLoansClientPage } from "@/app/dashboard/my-loans/my-loans-client-page";
import { loadBorrowerLoansData } from "@/app/dashboard/my-loans/queries";

export default async function MyLoansPage({
  searchParams,
}: {
  searchParams?: Promise<{
    loanStatus?: string;
    loanQuery?: string;
    loansPage?: string;
    pageSize?: string;
  }>;
}) {
  const auth = await requireDashboardAuth(["Borrower"]);
  if (!auth.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Loans</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{auth.message}</p>
        </CardContent>
      </Card>
    );
  }

  const filters = parseBorrowerLoansFilters((await searchParams) ?? {});
  const initialData = await loadBorrowerLoansData(auth.userId, filters);

  return <MyLoansClientPage initialData={initialData} initialFilters={filters} />;
}
