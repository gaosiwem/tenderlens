import { JobStatus, TenderStatus } from "@/lib/tenders.types";

export type StatusType = TenderStatus | JobStatus;
export type UiStatus = "NOT_READY" | "READY" | "NEEDS_ATTENTION";

export function toUiStatus(status: StatusType): UiStatus {
  switch (status) {
    case TenderStatus.COMPLETED:
    case JobStatus.COMPLETED:
      return "READY";
    case TenderStatus.FAILED:
    case JobStatus.FAILED:
      return "NEEDS_ATTENTION";
    default:
      return "NOT_READY";
  }
}

export function uiStatusLabel(status: UiStatus): string {
  switch (status) {
    case "READY":
      return "Ready";
    case "NEEDS_ATTENTION":
      return "Needs attention";
    default:
      return "Not ready";
  }
}

export function tenderStatusLabel(status: StatusType): string {
  return uiStatusLabel(toUiStatus(status));
}
