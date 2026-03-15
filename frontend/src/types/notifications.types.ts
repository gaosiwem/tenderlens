export interface NotificationEvent {
  id: string;
  orgId: string;
  type: string;
  entityType?: string;
  entityId?: string;
  meta?: any;
  createdAt: string;
}
