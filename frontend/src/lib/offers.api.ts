import { apiFetch } from "@/lib/api";

export type UpgradeOffer = {
  id: string;
  key: string;
  title: string;
  description: string;
  ctaLabel: string;
  status: "ACTIVE" | "EXPIRED" | "ACCEPTED" | "DISMISSED";
  expiresAt: string;
};

export async function getOffers() {
  return apiFetch<{ items: UpgradeOffer[] }>("/api/v1/billing/offers", {
    method: "GET",
  });
}

export async function trackOfferEvent(
  offerId: string,
  name: "impression" | "click" | "accept" | "dismiss",
  meta?: any,
) {
  return apiFetch<{ ok: true }>(`/api/v1/billing/offers/${offerId}/event`, {
    method: "POST",
    body: JSON.stringify({ name, meta }),
  });
}
