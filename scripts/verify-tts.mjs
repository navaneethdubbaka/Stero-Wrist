/**
 * Smoke tests for TTS options mapping + policy resolve (no native audio).
 * Run: node scripts/verify-tts.mjs
 */

function mapSpeedToSpeechRate(speed) {
  return Math.min(2, Math.max(0.5, speed));
}

function ttsOptionsFromSettings(settings) {
  return {
    language: settings.language || 'en-US',
    voice: settings.voice || 'default',
    speed:
      Number.isFinite(settings.speed) && settings.speed > 0 ? settings.speed : 1,
  };
}

const DEFAULT_TTS_POLICY = {
  assistant_response: 'system',
  notification_critical: 'system',
  notification_high: 'system',
  notification_normal: 'silent',
  notification_low: 'silent',
};

function resolvePolicyProvider(event, settingsProvider, policy = DEFAULT_TTS_POLICY) {
  if (event === 'assistant_response') return settingsProvider;
  return policy[event];
}

function shouldSpeak(provider) {
  return provider !== 'silent';
}

function resolveTtsProvider(settingsProvider, event = 'assistant_response') {
  const policyChoice = resolvePolicyProvider(event, settingsProvider);
  if (!shouldSpeak(policyChoice)) {
    return { silent: true, usedSystemFallback: false };
  }
  const wantsCloud =
    settingsProvider === 'openai' ||
    settingsProvider === 'fish_audio' ||
    settingsProvider === 'custom_http';
  return { silent: false, usedSystemFallback: wantsCloud };
}

let failed = 0;
function assert(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`);
  if (!cond) failed += 1;
}

assert('rate clamp low', mapSpeedToSpeechRate(0.1) === 0.5);
assert('rate clamp high', mapSpeedToSpeechRate(5) === 2);
assert('rate mid', mapSpeedToSpeechRate(1.2) === 1.2);

const opts = ttsOptionsFromSettings({
  language: '',
  voice: '',
  speed: -1,
});
assert('default language', opts.language === 'en-US');
assert('default voice', opts.voice === 'default');
assert('default speed', opts.speed === 1);

assert(
  'assistant uses settings openai',
  resolvePolicyProvider('assistant_response', 'openai') === 'openai',
);
assert(
  'normal notify silent',
  resolvePolicyProvider('notification_normal', 'system') === 'silent',
);
assert(
  'critical notify system',
  resolvePolicyProvider('notification_critical', 'openai') === 'system',
);

const cloud = resolveTtsProvider('openai');
assert('cloud not silent', cloud.silent === false);
assert('cloud fallback flag', cloud.usedSystemFallback === true);

const system = resolveTtsProvider('system');
assert('system no fallback flag', system.usedSystemFallback === false);

if (failed) process.exit(1);
console.log('All TTS helper checks passed.');
