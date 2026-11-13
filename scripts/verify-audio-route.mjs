/**
 * Smoke tests for audio input preference → route policy (no native audio).
 * Run: node scripts/verify-audio-route.mjs
 */

function decideInputRoute(preference, hfpAvailable) {
  if (preference === 'phone') {
    return {
      preferWatch: false,
      expectedKind: 'phone',
      usingPhoneFallback: false,
      banner: null,
    };
  }
  if (preference === 'watch') {
    if (!hfpAvailable) {
      return {
        preferWatch: false,
        expectedKind: 'phone',
        usingPhoneFallback: true,
        banner: 'Watch mic unavailable — using phone mic',
      };
    }
    return {
      preferWatch: true,
      expectedKind: 'watch_hfp',
      usingPhoneFallback: false,
      banner: null,
    };
  }
  if (hfpAvailable) {
    return {
      preferWatch: true,
      expectedKind: 'watch_hfp',
      usingPhoneFallback: false,
      banner: null,
    };
  }
  return {
    preferWatch: false,
    expectedKind: 'phone',
    usingPhoneFallback: true,
    banner: 'Using phone mic',
  };
}

function normalizeInputPreference(value) {
  if (value === 'watch' || value === 'phone' || value === 'auto') return value;
  return 'auto';
}

function formatMicSourceLabel(info) {
  if (!info) return 'Mic: unknown';
  if (info.kind === 'watch_hfp') {
    return `Mic: ${info.label || 'Watch HFP'}`;
  }
  if (info.kind === 'phone') {
    return `Mic: ${info.label || 'Phone'}`;
  }
  return `Mic: ${info.label || 'Unknown'}`;
}

let failed = 0;
function assert(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`);
  if (!cond) failed += 1;
}

const autoHfp = decideInputRoute('auto', true);
assert('auto + HFP prefers watch', autoHfp.preferWatch === true);
assert('auto + HFP kind watch', autoHfp.expectedKind === 'watch_hfp');
assert('auto + HFP no banner', autoHfp.banner === null);

const autoNo = decideInputRoute('auto', false);
assert('auto no HFP phone', autoNo.preferWatch === false);
assert('auto no HFP fallback', autoNo.usingPhoneFallback === true);
assert('auto no HFP banner', autoNo.banner === 'Using phone mic');

const watchOk = decideInputRoute('watch', true);
assert('watch + HFP prefers', watchOk.preferWatch === true);

const watchFail = decideInputRoute('watch', false);
assert('watch no HFP fallback', watchFail.usingPhoneFallback === true);
assert(
  'watch no HFP banner',
  watchFail.banner === 'Watch mic unavailable — using phone mic',
);

const phone = decideInputRoute('phone', true);
assert('phone never SCO', phone.preferWatch === false);
assert('phone not fallback', phone.usingPhoneFallback === false);

assert('normalize default→auto', normalizeInputPreference('default') === 'auto');
assert('normalize empty→auto', normalizeInputPreference('') === 'auto');
assert('normalize watch', normalizeInputPreference('watch') === 'watch');

assert(
  'label watch',
  formatMicSourceLabel({ kind: 'watch_hfp', label: 'Pixel Watch' }) ===
    'Mic: Pixel Watch',
);
assert(
  'label phone',
  formatMicSourceLabel({ kind: 'phone', label: 'Phone mic' }) ===
    'Mic: Phone mic',
);

if (failed) {
  console.error(`${failed} audio route check(s) failed`);
  process.exit(1);
}
console.log('All audio route helper checks passed.');
