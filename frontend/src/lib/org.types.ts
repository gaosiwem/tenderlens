export type OrgMember = {
  userId: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
  name: string | null;
  email: string | null;
  isBillingAdmin?: boolean;
};
