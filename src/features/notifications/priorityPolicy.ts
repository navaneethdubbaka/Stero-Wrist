import type {
  NotificationPriority,
  NotificationSettings,
  PriorityNotifyRule,
} from '../../shared/types/settings';
import { createDefaultPriorityRules } from '../../shared/types/settings';
import type { HermesNotification } from './types';

export function parseHhMm(value: string): { hours: number; minutes: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return { hours, minutes };
}

function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Inclusive quiet-hours window in local time. Supports overnight (e.g. 22:00–07:00).
 */
export function isInQuietHours(
  now: Date,
  startHhMm: string,
  endHhMm: string,
): boolean {
  const start = parseHhMm(startHhMm);
  const end = parseHhMm(endHhMm);
  if (!start || !end) return false;

  const nowM = minutesSinceMidnight(now);
  const startM = start.hours * 60 + start.minutes;
  const endM = end.hours * 60 + end.minutes;

  if (startM === endM) {
    // Same start/end → treat as full-day quiet when enabled.
    return true;
  }
  if (startM < endM) {
    return nowM >= startM && nowM < endM;
  }
  // Overnight: e.g. 22:00 → 07:00
  return nowM >= startM || nowM < endM;
}

export function ruleForPriority(
  settings: NotificationSettings,
  priority: NotificationPriority,
): PriorityNotifyRule {
  const defaults = createDefaultPriorityRules();
  const rule = settings.priorityRules?.[priority];
  return {
    notify: rule?.notify ?? defaults[priority].notify,
    speak: rule?.speak ?? defaults[priority].speak,
  };
}

export function shouldShowNotification(
  note: HermesNotification,
  settings: NotificationSettings,
): boolean {
  return ruleForPriority(settings, note.priority).notify;
}

/**
 * User priority speak AND payload.speak !== false, then quiet-hours gate.
 */
export function shouldSpeakNotification(
  note: HermesNotification,
  settings: NotificationSettings,
  now: Date = new Date(),
): boolean {
  const rule = ruleForPriority(settings, note.priority);
  if (!rule.speak) return false;
  if (note.speak === false) return false;

  if (settings.quietHoursEnabled) {
    const quiet = isInQuietHours(
      now,
      settings.quietHoursStart,
      settings.quietHoursEnd,
    );
    if (quiet) {
      if (note.priority === 'critical' && settings.criticalDuringQuietHours) {
        return true;
      }
      return false;
    }
  }

  return true;
}

export function clampSpeechVolume(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

/** Pure helper for queue pressure tests: sort critical before high. */
export function compareNotificationPriority(
  a: NotificationPriority,
  b: NotificationPriority,
): number {
  const rank: Record<NotificationPriority, number> = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3,
  };
  return rank[a] - rank[b];
}
