/**
 * Smoke tests for TTS options mapping + policy resolve + gateway body (no native audio).
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

function resolvePolicyProvider(event, settingsProvider, eventProviders) {
  const override = eventProviders?.[event];
  if (override !== undefined) return override;
  return settingsProvider;
}

function shouldSpeak(provider) {
  return provider !== 'silent';
}

function resolveTtsProvider(settingsProvider, event = 'assistant_response', tts = {}) {
  const policyChoice = resolvePolicyProvider(
    event,
    settingsProvider,
    tts.eventProviders,
  );
  if (!shouldSpeak(policyChoice)) {
    return { silent: true, usedSystemFallback: false };
  }
  const wantsCloud =
    policyChoice === 'openai' ||
    policyChoice === 'fish_audio' ||
    policyChoice === 'custom_http';
  const gateway = (tts.gatewayUrl || '').trim();
  if (wantsCloud && !gateway) {
    return { silent: false, usedSystemFallback: true };
  }
  if (wantsCloud && gateway) {
    return { silent: false, usedSystemFallback: false };
  }
  return { silent: false, usedSystemFallback: false };
}

function buildGatewayRequest(provider, text, options) {
  return {
    provider,
    text,
    voice: options.voice || 'default',
    model: options.model || '',
    language: options.language || 'en-US',
    speed: options.speed || 1,
    voice_reference_id: options.voiceReferenceId || '',
  };
}

function resolveEffectiveTts(globalTts, profile) {
  if (!profile?.ttsOverride) return globalTts;
  return { ...globalTts, ...profile.ttsOverride };
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
  'event override silent',
  resolvePolicyProvider('notification_low', 'openai', {
    notification_low: 'silent',
  }) === 'silent',
);
assert(
  'critical notify follows settings',
  resolvePolicyProvider('notification_critical', 'openai') === 'openai',
);

const cloudNoGw = resolveTtsProvider('openai', 'assistant_response', {
  gatewayUrl: '',
});
assert('cloud without gateway falls back', cloudNoGw.usedSystemFallback === true);
assert('cloud without gateway not silent', cloudNoGw.silent === false);

const cloudGw = resolveTtsProvider('openai', 'assistant_response', {
  gatewayUrl: 'https://gw.example/tts',
});
assert('cloud with gateway no fallback flag', cloudGw.usedSystemFallback === false);

const system = resolveTtsProvider('system');
assert('system no fallback flag', system.usedSystemFallback === false);

const body = buildGatewayRequest('fish_audio', 'Hello', {
  voice: 'nova',
  model: 'm1',
  language: 'en-US',
  speed: 1.1,
  voiceReferenceId: 'ref-1',
});
assert('gateway provider', body.provider === 'fish_audio');
assert('gateway text', body.text === 'Hello');
assert('gateway voice_reference_id', body.voice_reference_id === 'ref-1');

const effective = resolveEffectiveTts(
  { provider: 'system', gatewayUrl: '', voice: 'a' },
  { ttsOverride: { provider: 'openai', gatewayUrl: 'https://x' } },
);
assert('profile override provider', effective.provider === 'openai');
assert('profile override gateway', effective.gatewayUrl === 'https://x');

if (failed) process.exit(1);
console.log('All TTS helper checks passed.');
