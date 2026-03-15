import { cn } from "@/lib/utils";
import { TenderStatus, JobStatus } from "@/lib/tenders.types";
import { tenderStatusLabel, toUiStatus } from "@/lib/tender-status";

type StatusType = TenderStatus | JobStatus;

const styles: Record<string, string> = {
  NOT_READY: "bg-amber-50 text-amber-700 border-amber-200",
  READY: "bg-green-50 text-green-700 border-green-200",
  NEEDS_ATTENTION: "bg-red-50 text-red-700 border-red-200",
};

export function StatusBadge({
  status,
  className,
}: {
  status: StatusType;
  className?: string;
}) {
  const uiStatus = toUiStatus(status);

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border",
        styles[uiStatus] || "bg-gray-100 text-gray-800",
        className,
      )}
      title={`Internal status: ${status}`}
    >
      {tenderStatusLabel(status)}
    </span>
  );
}
