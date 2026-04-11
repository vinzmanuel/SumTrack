type RoleName =
  | "Admin"
  | "Auditor"
  | "Branch Manager"
  | "Secretary"
  | "Collector"
  | "Borrower"
  | string
  | null
  | undefined;

export function getDeactivatedAccountMessage(roleName: RoleName) {
  switch (roleName) {
    case "Admin":
      return "Your account has been deactivated. Please contact the main administrator.";
    case "Secretary":
    case "Collector":
      return "Your account has been deactivated. Please contact the Branch Manager.";
    case "Borrower":
      return "Your account has been deactivated. Please contact your collector or branch office.";
    case "Auditor":
    case "Branch Manager":
    default:
      return "Your account has been deactivated. Please contact the administrator.";
  }
}
