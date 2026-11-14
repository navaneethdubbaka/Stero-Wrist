/**
 * Smoke tests for inbox filter/batch/dedupe/context helpers (no SQLite).
 * Run: node scripts/verify-inbox.mjs
 */

function matchesInboxFilter(row, filter) {
  switch (filter) {
    case 'all':
      return !row.dismissed;
    case 'critical':
    case 'high':
    case 'normal':
    case 'low':
      return !row.dismissed && row.priority === filter;
    case 'unread':
      return !row.dismissed && !row.acknowledged;
    case 'acknowledged':
      return !row.dismissed && row.acknowledged;
    default:
      return true;
  }
}

function matchesInboxQuery(row, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  return (
    row.title.toLowerCase().includes(q) ||
    row.message.toLowerCase().includes(q) ||
    (row.source?.toLowerCase().includes(q) ?? false) ||
    row.notificationId.toLowerCase().includes(q)
  );
}

function shouldCreateBatch(count, threshold = 3) {
  return count >= threshold;
}

function decideDuplicate(existingById, existingByKey) {
  return Boolean(existingById || existingByKey);
}

function fillContext(template, context) {
  const contextJson =
    context === undefined || context === null ? 'null' : JSON.stringify(context);
  return template.replaceAll('{{context}}', contextJson);
}

let failed = 0;
function assert(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`);
  if (!cond) failed += 1;
}

const base = {
  notificationId: 'n1',
  title: 'Deploy done',
  message: 'Agent shipped',
  priority: 'normal',
  source: 'deployment_cron',
  dismissed: false,
  acknowledged: false,
};

assert('filter all', matchesInboxFilter(base, 'all') === true);
assert(
  'filter critical miss',
  matchesInboxFilter(base, 'critical') === false,
);
assert(
  'filter unread',
  matchesInboxFilter(base, 'unread') === true,
);
assert(
  'filter acked',
  matchesInboxFilter({ ...base, acknowledged: true }, 'acknowledged') === true,
);
assert(
  'dismissed hidden from all',
  matchesInboxFilter({ ...base, dismissed: true }, 'all') === false,
);

assert('query title', matchesInboxQuery(base, 'deploy') === true);
assert('query miss', matchesInboxQuery(base, 'zzz') === false);

assert('batch below threshold', shouldCreateBatch(2) === false);
assert('batch at threshold', shouldCreateBatch(3) === true);

assert('dedupe by id', decideDuplicate({ id: 'x' }, null) === true);
assert('dedupe by key', decideDuplicate(null, { id: 'y' }) === true);
assert('dedupe new', decideDuplicate(null, null) === false);

const tpl = `{ "context": {{context}} }`;
assert(
  'context null',
  JSON.parse(fillContext(tpl, null)).context === null,
);
assert(
  'context object',
  JSON.parse(fillContext(tpl, { notification_id: 'notification-002' }))
    .context.notification_id === 'notification-002',
);

if (failed) {
  console.error(`${failed} inbox check(s) failed`);
  process.exit(1);
}
console.log('All inbox helper checks passed.');
