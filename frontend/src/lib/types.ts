export type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export type Org = {
  id: string;
  name: string;
  slug: string;
};

export type MeResponse = {
  user: {
    id: string;
    email: string;
    name: string | null;
    createdAt: string;
    emailVerifiedAt?: string | null;
  };
  orgs: { org: Org; role: Role }[];
};
