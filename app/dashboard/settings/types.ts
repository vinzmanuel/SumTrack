export type SelfProfileDetail = {
  userId: string;
  fullName: string;
  firstName: string;
  middleName: string;
  lastName: string;
  companyId: string;
  username: string;
  roleName: string;
  status: "active" | "inactive";
  scopeLabel: string;
  contactNo: string | null;
  email: string | null;
  dateCreated: string | null;
};
