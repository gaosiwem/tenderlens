import { apiFetch, apiUploadFile } from "@/lib/api";
import type {
  OrgBusinessDocsResponse,
  OrgBusinessDocUploadResponse,
} from "./org-docs.types";

export async function listOrgBusinessDocs() {
  return apiFetch<OrgBusinessDocsResponse>("/api/v1/org-docs/files", {
    method: "GET",
  });
}

export async function uploadOrgBusinessDoc(file: File) {
  return apiUploadFile<OrgBusinessDocUploadResponse>("/api/v1/org-docs/files", file);
}

export async function deleteOrgBusinessDoc(fileId: string) {
  return apiFetch<{ id: string; deleted: boolean }>(`/api/v1/org-docs/files/${fileId}`, {
    method: "DELETE",
  });
}
