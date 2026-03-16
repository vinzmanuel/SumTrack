export function getManagedUserViewHref(params: {
  roleName: string;
  userId: string;
  companyId: string;
}, options?: {
  returnTo?: string;
  source?: "manage-users" | "branches";
}) {
  const collectorParams = new URLSearchParams();
  if (options?.source) {
    collectorParams.set("source", options.source);
  }
  if (options?.returnTo) {
    collectorParams.set("returnTo", options.returnTo);
  }

  if (params.roleName === "Borrower") {
    const borrowerParams = new URLSearchParams();
    if (options?.source) {
      borrowerParams.set("source", options.source);
    }
    if (options?.returnTo) {
      borrowerParams.set("returnTo", options.returnTo);
    }

    const query = borrowerParams.toString();
    return query
      ? `/dashboard/borrowers/${params.userId}?${query}`
      : `/dashboard/borrowers/${params.userId}`;
  }

  if (params.roleName === "Collector") {
    const query = collectorParams.toString();
    return query
      ? `/dashboard/collectors/${params.userId}?${query}`
      : `/dashboard/collectors/${params.userId}`;
  }

  if (params.roleName === "Admin") {
    const query = collectorParams.toString();
    return query
      ? `/dashboard/admin/${params.companyId}?${query}`
      : `/dashboard/admin/${params.companyId}`;
  }

  if (params.roleName === "Auditor") {
    const query = collectorParams.toString();
    return query
      ? `/dashboard/auditor/${params.companyId}?${query}`
      : `/dashboard/auditor/${params.companyId}`;
  }

  if (params.roleName === "Branch Manager") {
    const query = collectorParams.toString();
    return query
      ? `/dashboard/branch-manager/${params.companyId}?${query}`
      : `/dashboard/branch-manager/${params.companyId}`;
  }

  if (params.roleName === "Secretary") {
    const query = collectorParams.toString();
    return query
      ? `/dashboard/secretary/${params.companyId}?${query}`
      : `/dashboard/secretary/${params.companyId}`;
  }

  return `/dashboard/manage-user-accounts/${params.userId}`;
}
