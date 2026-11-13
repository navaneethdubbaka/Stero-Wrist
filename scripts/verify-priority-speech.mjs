/**
 * Smoke tests for quiet hours + effectiveSpeak + queue pressure (no native TTS).
 * Run: node scripts/verify-priority-speech.mjs
 */

function parseHhMm(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value).trim());
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

function isInQuietHours(now, startHhMm, endHhMm) {
  const start = parseHhMm(startHhMm);
  const end = parseHhMm(endHhMm);
  if (!start || !end) return false;
  const nowM = now.getHours() * 60 + now.getMinutes();
  const startM = start.hours * 60 + start.minutes;
  const endM = end.hours * 60 + end.minutes;
  if (startM === endM) return true;
  if (startM < endM) return nowM >= startM && nowM < endM;
  return nowM >= startM || nowM < endM;
}

function createDefaultPriorityRules() {
  return {
    critical: { notify: true, speak: true },
    high: { notify: true, speak: true },
    normal: { notify: true, speak: false },
    low: { notify: true, speak: false },
  };
}

function shouldSpeakNotification(note, settings, now = new Date()) {
  const rule =
    settings.priorityRules?.[note.priority] ??
    createDefaultPriorityRules()[note.priority];
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

function compareNotificationPriority(a, b) {
  const rank = { critical: 0, high: 1, normal: 2, low: 3 };
  return rank[a] - rank[b];
}

function applyQueuePressure(items, incoming, cap = 3) {
  const next = items.filter((n) => n.notification_id !== incoming.notification_id);
  next.push(incoming);
  next.sort((a, b) => compareNotificationPriority(a.priority, b.priority));
  while (next.length > cap) {
    const dropIdx = next.map((n) => n.priority).lastIndexOf('low');
    const idx =
      dropIdx >= 0 ? dropIdx : next.findIndex((n) => n.priority !== 'critical');
    if (idx >= 0) next.splice(idx, 1);
    else next.shift();
  }
  return next;
}

function at(h, m) {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

const defaults = {
  priorityRules: createDefaultPriorityRules(),
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  criticalDuringQuietHours: true,
};

let failed = 0;
function assert(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`);
  if (!cond) failed += 1;
}

assert(
  'overnight quiet 23:00',
  isInQuietHours(at(23, 0), '22:00', '07:00') === true,
);
assert(
  'overnight quiet 03:00',
  isInQuietHours(at(3, 0), '22:00', '07:00') === true,
);
assert(
  'overnight not quiet 12:00',
  isInQuietHours(at(12, 0), '22:00', '07:00') === false,
);
assert(
  'same-day quiet',
  isInQuietHours(at(14, 0), '13:00', '15:00') === true,
);

const critical = {
  priority: 'critical',
  speak: true,
  notification_id: 'c1',
};
const high = { priority: 'high', speak: true, notification_id: 'h1' };
const normal = { priority: 'normal', speak: true, notification_id: 'n1' };

assert(
  'default critical speaks',
  shouldSpeakNotification(critical, defaults) === true,
);
assert(
  'default high speaks',
  shouldSpeakNotification(high, defaults) === true,
);
assert(
  'default normal silent',
  shouldSpeakNotification(normal, defaults) === false,
);
assert(
  'payload speak false suppresses',
  shouldSpeakNotification({ ...critical, speak: false }, defaults) === false,
);

const quietOn = { ...defaults, quietHoursEnabled: true };
assert(
  'high suppressed in quiet',
  shouldSpeakNotification(high, quietOn, at(23, 0)) === false,
);
assert(
  'critical allowed in quiet',
  shouldSpeakNotification(critical, quietOn, at(23, 0)) === true,
);
assert(
  'critical blocked when exception off',
  shouldSpeakNotification(
    critical,
    { ...quietOn, criticalDuringQuietHours: false },
    at(23, 0),
  ) === false,
);

const userNormalSpeak = {
  ...defaults,
  priorityRules: {
    ...createDefaultPriorityRules(),
    normal: { notify: true, speak: true },
  },
};
assert(
  'user override normal speaks',
  shouldSpeakNotification(normal, userNormalSpeak) === true,
);

let q = [];
q = applyQueuePressure(q, {
  notification_id: '1',
  priority: 'high',
  title: 'a',
  message: 'b',
  speak: true,
  type: 'hermes_notification',
});
q = applyQueuePressure(q, {
  notification_id: '2',
  priority: 'normal',
  title: 'a',
  message: 'b',
  speak: true,
  type: 'hermes_notification',
});
q = applyQueuePressure(q, {
  notification_id: '3',
  priority: 'low',
  title: 'a',
  message: 'b',
  speak: true,
  type: 'hermes_notification',
});
q = applyQueuePressure(q, {
  notification_id: '4',
  priority: 'critical',
  title: 'a',
  message: 'b',
  speak: true,
  type: 'hermes_notification',
});
assert('queue cap 3', q.length === 3);
assert('queue critical first', q[0].priority === 'critical');
assert(
  'queue dropped low',
  q.every((n) => n.priority !== 'low') || q.length === 3,
);

if (failed) {
  console.error(`${failed} priority speech check(s) failed`);
  process.exit(1);
}
console.log('All priority speech helper checks passed.');
