import { LifecycleTendersPage } from "@/components/tenderlens/lifecycle-tenders-page";

export default function CancelledTendersPage() {
  return (
    <LifecycleTendersPage
      lifecycle="cancelled"
      pageTitle="Cancelled Tenders"
      description="Browse cancelled opportunities imported from eTenders."
      tableTitle="All Cancelled Tenders"
      emptyTitle="No cancelled tenders yet"
      emptyDescription="No cancelled tenders are available yet."
      detailBasePath="/cancelled"
      dateColumnLabel="Cancelled Date"
    />
  );
}
