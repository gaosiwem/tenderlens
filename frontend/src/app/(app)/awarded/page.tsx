import { LifecycleTendersPage } from "@/components/tenderlens/lifecycle-tenders-page";

export default function AwardedTendersPage() {
  return (
    <LifecycleTendersPage
      lifecycle="awarded"
      pageTitle="Awarded Tenders"
      description="Browse awarded opportunities imported from eTenders."
      tableTitle="All Awarded Tenders"
      emptyTitle="No awarded tenders yet"
      emptyDescription="No awarded tenders are available yet."
      detailBasePath="/awarded"
      dateColumnLabel="Award Date"
      showAmount
    />
  );
}
