import { apiFetch } from "@/lib/api";

export async function updateSeats(seats: number) {
  return apiFetch<{ seatsPurchased: number }>("/api/v1/billing/seats/update", {
    method: "POST",
    body: JSON.stringify({ seats }),
  });
}

export async function changePlan(plan: "PRO" | "BUSINESS") {
  return apiFetch<{ plan: string }>("/api/v1/billing/plan/change", {
    method: "POST",
    body: JSON.stringify({ plan }),
  });
}
