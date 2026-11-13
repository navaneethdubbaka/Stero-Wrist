/**
 * Smoke checks for Home channel lantern logic (no RN runtime required).
 * Run: node scripts/verify-channel-status.mjs
 */

function hermesLanternState(activeProfile) {
  if (!activeProfile) return 'off';
  const url = activeProfile.webhook.url.trim();
  if (!url) return 'pending';
  if (url.startsWith('http://')) return 'pending';
  if (url.startsWith('https://')) return 'ready';
  return 'error';
}

const cases = [
  { name: 'empty', profile: null, expect: 'off' },
  {
    name: 'no url',
    profile: { webhook: { url: '' } },
    expect: 'pending',
  },
  {
    name: 'http',
    profile: { webhook: { url: 'http://localhost:3000/hook' } },
    expect: 'pending',
  },
  {
    name: 'https',
    profile: { webhook: { url: 'https://hermes.example/webhook' } },
    expect: 'ready',
  },
  {
    name: 'bad',
    profile: { webhook: { url: 'ftp://x' } },
    expect: 'error',
  },
];

let failed = 0;
for (const c of cases) {
  const got = hermesLanternState(c.profile);
  const ok = got === c.expect;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${c.name}: ${got}`);
  if (!ok) failed += 1;
}

if (failed) {
  process.exit(1);
}
console.log('All channel status checks passed.');
