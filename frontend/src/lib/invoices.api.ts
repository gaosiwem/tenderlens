import { apiFetch } from "./api";
import type { OrgInvoice } from "./invoices.types";

export async function listInvoices() {
  return apiFetch<{ items: OrgInvoice[] }>("/api/v1/billing/invoices", {
    method: "GET",
  });
}
