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
  const wantsGateway =
    policyChoice === 'openai' || policyChoice === 'custom_http';
  const gateway = (tts.gatewayUrl || '').trim();
  if (wantsGateway && !gateway) {
    return { silent: false, usedSystemFallback: true };
  }
  if (wantsGateway && gateway) {
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

const FISH_MODEL_HEADERS = new Set([
  's1',
  's2-pro',
  's2.1-pro',
  's2.1-pro-free',
  'drama-3',
]);

function resolveFishModelAndVoice(model, voiceReferenceId) {
  const headerOrId = (model || '').trim();
  const voice = (voiceReferenceId || '').trim();
  if (voice) {
    return {
      header: FISH_MODEL_HEADERS.has(headerOrId) ? headerOrId : 's2.1-pro-free',
      referenceId: voice,
    };
  }
  if (FISH_MODEL_HEADERS.has(headerOrId)) {
    return { header: headerOrId, referenceId: '' };
  }
  return { header: 's2.1-pro-free', referenceId: headerOrId };
}

function buildFishTtsRequest(text, opts) {
  const body = {
    text: text.trim(),
    temperature: 0.7,
    top_p: 0.7,
    prosody: {
      speed: opts.speed > 0 ? opts.speed : 1,
      volume: 0,
      normalize_loudness: true,
    },
    chunk_length: 300,
    normalize: true,
    format: 'mp3',
    sample_rate: 44100,
    mp3_bitrate: 128,
    latency: 'normal',
    max_new_tokens: 1024,
    repetition_penalty: 1.2,
    min_chunk_length: 50,
    condition_on_previous_chunks: true,
    early_stop_threshold: 1,
  };
  if (opts.referenceId) body.reference_id = opts.referenceId;
  return body;
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

const body = buildGatewayRequest('openai', 'Hello', {
  voice: 'nova',
  model: 'm1',
  language: 'en-US',
  speed: 1.1,
  voiceReferenceId: 'ref-1',
});
assert('gateway provider', body.provider === 'openai');
assert('gateway text', body.text === 'Hello');
assert('gateway voice_reference_id', body.voice_reference_id === 'ref-1');

const fishIds = resolveFishModelAndVoice(
  's2.1-pro-free',
  '933563129e564b19a115bedd57b7406a',
);
assert('fish header model', fishIds.header === 's2.1-pro-free');
assert(
  'fish reference_id',
  fishIds.referenceId === '933563129e564b19a115bedd57b7406a',
);
const fishVoiceInModel = resolveFishModelAndVoice(
  '933563129e564b19a115bedd57b7406a',
  '',
);
assert('fish voice id in model field', fishVoiceInModel.header === 's2.1-pro-free');
assert(
  'fish voice id promoted',
  fishVoiceInModel.referenceId === '933563129e564b19a115bedd57b7406a',
);
const fishBody = buildFishTtsRequest('Hello! Welcome to Fish Audio.', {
  referenceId: fishIds.referenceId,
  speed: 1,
});
assert('fish body text', fishBody.text === 'Hello! Welcome to Fish Audio.');
assert('fish body reference_id', fishBody.reference_id === fishIds.referenceId);
assert('fish body format mp3', fishBody.format === 'mp3');
assert('fish body sample_rate', fishBody.sample_rate === 44100);
assert('fish no provider field', fishBody.provider === undefined);

const fishNoGw = resolveTtsProvider('fish_audio', 'assistant_response', {
  gatewayUrl: '',
});
assert('fish without gateway stays cloud', fishNoGw.usedSystemFallback === false);

const effective = resolveEffectiveTts(
  { provider: 'system', gatewayUrl: '', voice: 'a' },
  { ttsOverride: { provider: 'openai', gatewayUrl: 'https://x' } },
);
assert('profile override provider', effective.provider === 'openai');
assert('profile override gateway', effective.gatewayUrl === 'https://x');

if (failed) process.exit(1);
console.log('All TTS helper checks passed.');
