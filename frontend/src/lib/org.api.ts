import { apiFetch } from "@/lib/api";
import type { OrgMember } from "./org.types";

// GET /api/v1/orgs/me/members
export async function listOrgMembers() {
  return apiFetch<{ items: OrgMember[] }>("/api/v1/orgs/me/members", {
    method: "GET",
  });
}
