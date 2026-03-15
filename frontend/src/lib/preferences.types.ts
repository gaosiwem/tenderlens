export type NotificationPrefs = {
  id: string;
  orgId: string;
  userId: string;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  whatsappNumber: string | null;
  whatsappVerifiedAt: string | null;
  eventTypes: string[];
  quietStart: string | null;
  quietEnd: string | null;
  digestMode: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PrefsResponse = {
  prefs: NotificationPrefs;
  whatsappCost: number;
};
