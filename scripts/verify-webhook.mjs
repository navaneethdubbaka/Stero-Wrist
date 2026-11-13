/**
 * Smoke tests for webhook request builder + response mapper helpers.
 * Run: node scripts/verify-webhook.mjs
 */

function jsonEscape(value) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function fillTemplatePlaceholders(template, vars) {
  return template
    .replaceAll('{{text}}', jsonEscape(vars.text))
    .replaceAll('{{session_id}}', jsonEscape(vars.session_id))
    .replaceAll('{{mode}}', jsonEscape(vars.mode))
    .replaceAll('{{timestamp}}', jsonEscape(vars.timestamp));
}

function getByDotPath(value, path) {
  const parts = path.split('.').filter(Boolean);
  let current = value;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

function isRetryable(code) {
  return (
    code === 'network' ||
    code === 'timeout' ||
    code === 'http_429' ||
    code === 'http_5xx'
  );
}

let failed = 0;
function assert(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`);
  if (!cond) failed += 1;
}

const template = `{
  "text": "{{text}}",
  "source": "stero-wrist",
  "session_id": "{{session_id}}",
  "mode": "{{mode}}",
  "timestamp": "{{timestamp}}"
}`;

const filled = fillTemplatePlaceholders(template, {
  text: 'Say "hello"',
  session_id: 'session-1',
  mode: 'single_request',
  timestamp: '2026-11-13T00:00:00Z',
});

let parsed;
try {
  parsed = JSON.parse(filled);
} catch {
  parsed = null;
}

assert('template parses', parsed != null);
assert('text escaped quotes', parsed?.text === 'Say "hello"');
assert('session id', parsed?.session_id === 'session-1');

const body = {
  data: { response: 'Deployed', session_id: 'session-9' },
};
assert(
  'dot path response',
  getByDotPath(body, 'data.response') === 'Deployed',
);
assert(
  'dot path session',
  getByDotPath(body, 'data.session_id') === 'session-9',
);
assert('missing path', getByDotPath(body, 'missing.path') === undefined);

assert('retry network', isRetryable('network'));
assert('retry 429', isRetryable('http_429'));
assert('no retry 401', !isRetryable('http_401'));
assert('no retry 403', !isRetryable('http_403'));

if (failed) process.exit(1);
console.log('All webhook helper checks passed.');
