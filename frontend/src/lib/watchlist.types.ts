export type WatchlistReminderType =
  | "CLOSING_7D"
  | "CLOSING_24H"
  | "CLOSING_2H"
  | "SITE_VISIT";

export type WatchlistNotificationChannel = "email" | "whatsapp";

export type WatchlistItem = {
  id: string;
  orgId: string;
  userId: string;
  tenderId: string;
  templateId: string;
  createdAt: string;
  tenderTitle?: string | null;
  closingDate?: string | null;
  companyName?: string | null;
  notes?: string | null;
  reminderTypes?: WatchlistReminderType[];
  notificationChannels?: WatchlistNotificationChannel[];
};
