import { LifecycleTendersPage } from "@/components/tenderlens/lifecycle-tenders-page";

export default function ClosedTendersPage() {
  return (
    <LifecycleTendersPage
      lifecycle="closed"
      pageTitle="Closed Tenders"
      description="Browse closed opportunities imported from eTenders."
      tableTitle="All Closed Tenders"
      emptyTitle="No closed tenders yet"
      emptyDescription="No closed tenders are available yet."
      detailBasePath="/closed"
      dateColumnLabel="Closing Date"
    />
  );
}
