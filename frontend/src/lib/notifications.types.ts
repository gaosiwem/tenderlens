export type NotificationEvent = {
  id: string;
  orgId: string;
  type: string;
  entityType: string | null;
  entityId: string | null;
  meta: unknown | null;
  createdAt: string;
};

export type NotificationDelivery = {
  id: string;
  orgId: string;
  eventId: string;
  to: string;
  channel: string;
  status: string;
  attempts: number;
  lastAttemptAt: string | null;
  deferUntil: string | null;
  lastError: string | null;
  sentAt: string | null;
  idempotencyKey?: string | null;
  createdAt: string;
};
