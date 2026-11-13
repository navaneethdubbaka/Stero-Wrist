/**
 * Smoke tests for Hermes notification payload parse + register body + channels.
 * Run: node scripts/verify-notifications.mjs
 */

const PRIORITIES = new Set(['critical', 'high', 'normal', 'low']);

const PRIORITY_CHANNEL_IDS = {
  critical: 'hermes_critical',
  high: 'hermes_high',
  normal: 'hermes_normal',
  low: 'hermes_low',
};

function parseHermesNotification(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (data.type !== 'hermes_notification') return null;
  const notification_id =
    typeof data.notification_id === 'string' ? data.notification_id.trim() : '';
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const message = typeof data.message === 'string' ? data.message.trim() : '';
  const priorityRaw =
    typeof data.priority === 'string' ? data.priority.trim().toLowerCase() : '';
  if (!notification_id || !title || !message) return null;
  if (!PRIORITIES.has(priorityRaw)) return null;
  return {
    type: 'hermes_notification',
    notification_id,
    title,
    message,
    priority: priorityRaw,
    speak: data.speak === true,
  };
}

function buildDeviceTokenBody(deviceToken, profileId, platform = 'android') {
  return {
    device_token: deviceToken,
    platform,
    app: 'stero-wrist',
    profile_id: profileId,
  };
}

function channelIdForPriority(priority) {
  return PRIORITY_CHANNEL_IDS[priority];
}

function notifyLanternState(fcmEnabled, connection) {
  if (!fcmEnabled || connection === 'off') return 'off';
  if (connection === 'ready') return 'ready';
  if (connection === 'error') return 'error';
  return 'pending';
}

let failed = 0;
function assert(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`);
  if (!cond) failed += 1;
}

const valid = parseHermesNotification({
  type: 'hermes_notification',
  notification_id: 'notification-001',
  title: 'Deployment completed',
  message: 'Your voice agent was successfully deployed.',
  priority: 'normal',
  speak: false,
});
assert('valid parse', valid != null);
assert('valid id', valid?.notification_id === 'notification-001');
assert('speak false', valid?.speak === false);

const critical = parseHermesNotification({
  type: 'hermes_notification',
  notification_id: 'n2',
  title: 'Down',
  message: 'Server unreachable',
  priority: 'critical',
  speak: true,
});
assert('critical speak true', critical?.speak === true);
assert('critical priority', critical?.priority === 'critical');

assert(
  'bad type',
  parseHermesNotification({
    type: 'other',
    notification_id: 'x',
    title: 't',
    message: 'm',
    priority: 'normal',
  }) == null,
);
assert(
  'missing title',
  parseHermesNotification({
    type: 'hermes_notification',
    notification_id: 'x',
    title: '',
    message: 'm',
    priority: 'normal',
  }) == null,
);
assert(
  'bad priority',
  parseHermesNotification({
    type: 'hermes_notification',
    notification_id: 'x',
    title: 't',
    message: 'm',
    priority: 'urgent',
  }) == null,
);

const body = buildDeviceTokenBody('tok123', 'profile-1', 'ios');
assert('body token', body.device_token === 'tok123');
assert('body app', body.app === 'stero-wrist');
assert('body platform', body.platform === 'ios');
assert('body profile', body.profile_id === 'profile-1');

assert(
  'channel critical',
  channelIdForPriority('critical') === 'hermes_critical',
);
assert('channel low', channelIdForPriority('low') === 'hermes_low');

assert('lantern off', notifyLanternState(false, 'ready') === 'off');
assert('lantern ready', notifyLanternState(true, 'ready') === 'ready');
assert('lantern pending', notifyLanternState(true, 'pending') === 'pending');
assert('lantern error', notifyLanternState(true, 'error') === 'error');

if (failed) {
  console.error(`${failed} notification check(s) failed`);
  process.exit(1);
}
console.log('All notification helper checks passed.');
