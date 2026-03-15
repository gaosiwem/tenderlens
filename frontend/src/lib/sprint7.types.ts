export type AlertRule = {
  id: string;
  orgId: string;
  name: string;
  isEnabled: boolean;
  eventTypes: string[];
  tenderId: string | null;
  keywords: string[];
  cooldownMin: number;
  lastFiredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NotificationDelivery = {
  id: string;
  orgId: string;
  eventId: string;
  channel: string;
  to: string;
  status: "PENDING" | "SENT" | "FAILED";
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
};
