import type { HermesNotification, NotificationPriority } from './types';

const PRIORITIES = new Set<NotificationPriority>([
  'critical',
  'high',
  'normal',
  'low',
]);

function asRecord(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  return data as Record<string, unknown>;
}

/**
 * Validate illustrative Hermes FCM payload. Returns null for malformed messages.
 */
export function parseHermesNotification(data: unknown): HermesNotification | null {
  const obj = asRecord(data);
  if (!obj) return null;

  if (obj.type !== 'hermes_notification') return null;

  const notification_id =
    typeof obj.notification_id === 'string' ? obj.notification_id.trim() : '';
  const title = typeof obj.title === 'string' ? obj.title.trim() : '';
  const message = typeof obj.message === 'string' ? obj.message.trim() : '';

  // Presentation priority (ignore FCM transport priority).
  const presentation =
    typeof obj.presentation_priority === 'string'
      ? obj.presentation_priority.trim().toLowerCase()
      : typeof obj.priority === 'string'
        ? obj.priority.trim().toLowerCase()
        : '';

  if (!notification_id || !title || !message) return null;
  if (!PRIORITIES.has(presentation as NotificationPriority)) return null;

  // Explicit false suppresses; missing/true allows (user overrides still apply).
  const speak = obj.speak !== false;

  return {
    type: 'hermes_notification',
    notification_id,
    title,
    message,
    priority: presentation as NotificationPriority,
    speak,
    timestamp: typeof obj.timestamp === 'string' ? obj.timestamp : undefined,
    source: typeof obj.source === 'string' ? obj.source : undefined,
  };
}

/** Pull Hermes fields from a push notification content/data bag. */
export function extractPushData(content: {
  data?: Record<string, unknown>;
  title?: string | null;
  body?: string | null;
}): unknown {
  const data = content.data ?? {};
  if (data.type === 'hermes_notification') {
    return data;
  }
  // Some senders flatten fields onto data; accept if type present.
  if (typeof data.notification_id === 'string') {
    return {
      type: data.type ?? 'hermes_notification',
      ...data,
      title: data.title ?? content.title,
      message: data.message ?? content.body,
    };
  }
  return data;
}
