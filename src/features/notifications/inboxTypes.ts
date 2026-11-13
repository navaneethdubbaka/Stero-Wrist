import type { NotificationPriority } from './types';

export type DeliveryStatus =
  | 'received'
  | 'displayed'
  | 'spoken'
  | 'acked'
  | 'dismissed';

export type InboxFilter =
  | 'all'
  | 'critical'
  | 'high'
  | 'normal'
  | 'low'
  | 'unread'
  | 'acknowledged';

export type InboxNotification = {
  notificationId: string;
  title: string;
  message: string;
  priority: NotificationPriority;
  source: string | null;
  timestamp: string;
  dedupeKey: string | null;
  deliveryStatus: DeliveryStatus;
  spoken: boolean;
  acknowledged: boolean;
  dismissed: boolean;
  remindAt: string | null;
  isBatch: boolean;
  batchId: string | null;
  rawJson: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpsertIncomingResult = {
  isDuplicate: boolean;
  row: InboxNotification;
};

export type InboxListOptions = {
  filter?: InboxFilter;
  query?: string;
  limit?: number;
};
