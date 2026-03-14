export function getManagedUserViewHref(params: {
  roleName: string;
  userId: string;
  companyId: string;
}, options?: {
  returnTo?: string;
  source?: "manage-users";
}) {
  const collectorParams = new URLSearchParams();
  if (options?.source === "manage-users") {
    collectorParams.set("source", "manage-users");
  }
  if (options?.returnTo) {
    collectorParams.set("returnTo", options.returnTo);
  }

  if (params.roleName === "Borrower") {
    const borrowerParams = new URLSearchParams();
    if (options?.source === "manage-users") {
      borrowerParams.set("source", "manage-users");
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
    return `/dashboard/admin/${params.companyId}`;
  }

  if (params.roleName === "Auditor") {
    return `/dashboard/auditor/${params.companyId}`;
  }

  if (params.roleName === "Branch Manager") {
    return `/dashboard/branch-manager/${params.companyId}`;
  }

  if (params.roleName === "Secretary") {
    return `/dashboard/secretary/${params.companyId}`;
  }

  return `/dashboard/manage-user-accounts/${params.userId}`;
}
