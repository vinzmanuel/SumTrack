export const SUPERADMIN_USER_ID = "1a8dda73-b101-4006-9dfb-f0cf4bbb2088";

export function isSuperAdmin(userId: string | null | undefined) {
  return userId === SUPERADMIN_USER_ID;
}

export function canCreateAdminAccounts(userId: string | null | undefined) {
  return isSuperAdmin(userId);
}

export function isProtectedSuperAdminAccount(userId: string | null | undefined) {
  return isSuperAdmin(userId);
}
