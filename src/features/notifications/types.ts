export type NotificationPriority = 'critical' | 'high' | 'normal' | 'low';

export type HermesNotification = {
  type: 'hermes_notification';
  notification_id: string;
  title: string;
  message: string;
  priority: NotificationPriority;
  speak: boolean;
  timestamp?: string;
  source?: string;
  /** Optional secondary unique key for duplicate suppression. */
  dedupe_key?: string;
};

export type NotifyConnectionStatus = 'off' | 'pending' | 'ready' | 'error';

export type DeviceTokenRegistrationBody = {
  device_token: string;
  platform: 'android' | 'ios';
  app: 'stero-wrist';
  profile_id: string;
};

export const PRIORITY_CHANNEL_IDS: Record<NotificationPriority, string> = {
  critical: 'hermes_critical',
  high: 'hermes_high',
  normal: 'hermes_normal',
  low: 'hermes_low',
};

export const PRIORITY_CATEGORY_IDS: Record<NotificationPriority, string> = {
  critical: 'hermes_critical',
  high: 'hermes_high',
  normal: 'hermes_normal',
  low: 'hermes_low',
};
