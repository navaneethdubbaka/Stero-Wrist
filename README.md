# Stero Wrist

Android / iOS companion app that turns a smartwatch into a voice + notification front-end for Hermes (and other AI backends).

**Phase 0–10 status:** Scaffold through cloud TTS gateway, Conversation / Continuous modes, profile audio overrides, release hardening (EAS, privacy/hardware docs).

## Disk layout (E:)

| Path | Use |
|---|---|
| `E:\Stero Wrist` | Project (Cursor workspace — source of truth) |
| `E:\sw` | Optional short-path sync for Android native builds |
| `E:\dev\Android\Sdk` | Android SDK |
| `E:\dev\gradle` | Gradle cache |
| `E:\dev\npm-cache` | npm cache |

```powershell
powershell -ExecutionPolicy Bypass -File "E:\Stero Wrist\scripts\setup-e-drive-env.ps1"
```

## Setup

```powershell
cd "E:\Stero Wrist"
npm install
npx tsc --noEmit
npm run test:voice
npm run test:webhook
npm run test:tts
npm run test:audio
npm run test:notifications
npm run test:priority-speech
npm run test:inbox
npx expo-doctor
npx expo start
```

Dev client rebuild required for native modules (`expo-sqlite`, FCM, speech, `stero-assistant`, `expo-audio`).

## EAS build & submit

Profiles live in [`eas.json`](eas.json): `development` (dev client), `preview` (internal APK), `production` (AAB / store).

```powershell
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform android
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest build --profile production --platform android
npx eas-cli@latest submit --profile production --platform android
```

Optional crash reporting: set `EXPO_PUBLIC_SENTRY_DSN` in EAS secrets and install `@sentry/react-native`. Without a DSN, observability stays off.

Version: bump `expo.version` in `app.json` for user-facing releases; production profile uses remote app version source / `autoIncrement` for store builds.

## Phase highlights

### Phase 1–7
ChannelStrip, profiles, webhook, STT, system TTS, Android assistant + HFP, FCM, priority speech.

### Phase 8
`expo-sqlite` inbox, durable spoken IDs, batching, Ask Hermes context, optional ack hooks.

### Phase 9 — Advanced modes & cloud TTS
- **TTS gateway-first:** Settings → Text to speech → gateway URL. Body: `{ provider, text, voice, model, language, speed, voice_reference_id }`. Failures → system TTS. On-device API keys are for gateway auth / local testing only.
- **Shared player:** `playTtsAudio` via `expo-audio` for file/stream; system stays on `expo-speech`.
- **Conversation:** after each reply, listens again with the same `sessionId` (capped turns).
- **Continuous:** opt-in with battery warning; Cancel stops recognition.
- **Profile TTS override** + **output** `phone_speaker | earbuds | bluetooth` (applied after SCO teardown).
- **iOS:** Shortcuts / Action Button / Back Tap → `stero-wrist://activate` (no SiriKit in v1).

### Phase 10 — Hardening
- FCM-only notify path; mic/SCO stop after listen; Continuous cleaned on Cancel; no silent delayed voice after reconnect.
- HTTPS enforcement for webhooks + TTS gateway outside `__DEV__`.
- Optional Sentry (PII scrubbed); inbox **store full body** toggle (default on).
- Docs: [docs/PRIVACY.md](docs/PRIVACY.md), [docs/HARDWARE.md](docs/HARDWARE.md).

## Battery & background

- Prefer **Single Request** for everyday use.
- **Continuous** keeps the recognizer alive — confirm the in-app battery warning before enabling.
- Notifications do **not** use WebSockets or polling.

## TTS gateway contract

`POST` your gateway with JSON:

```json
{
  "provider": "openai",
  "text": "Hello",
  "voice": "default",
  "model": "",
  "language": "en-US",
  "speed": 1,
  "voice_reference_id": ""
}
```

Respond with `{ "url": "https://…" }` or `{ "audio_base64": "…", "mime": "audio/mpeg" }`, or raw audio bytes.

## iOS Shortcut activation

1. Shortcuts → New Shortcut → **Open URLs**
2. URL: `stero-wrist://activate`
3. Add to Home Screen, Action Button, or Back Tap
4. Cold start and warm resume both start a phone-mic voice session

Watch mic / default-assistant on iOS are unsupported — see [docs/HARDWARE.md](docs/HARDWARE.md).

## Manual checklists

### Phase 9
- [ ] Conversation multi-turn keeps session; Cancel ends loop
- [ ] Continuous shows battery warning once; Cancel stops STT
- [ ] Cloud TTS without gateway → system speak
- [ ] Cloud fail mid-request → system fallback
- [ ] Profile TTS override applies when profile active
- [ ] Output preference selectable; watch button still activates on Android

### Phase 10 / store readiness
- [ ] Android DoD path from PRD §22 on a real device
- [ ] Privacy / hardware docs reviewed
- [ ] Screenshots placeholders ready for store listing (icon, home, settings, inbox)
- [ ] `npm run test:*` green; `npx tsc --noEmit` clean
- [ ] Unsupported devices / OEM quirks understood ([docs/HARDWARE.md](docs/HARDWARE.md))

### Inbox (Phase 8)
- [ ] Duplicate FCM id not re-spoken
- [ ] Filter Unread / search works
- [ ] Acknowledge + Dismiss
- [ ] Ask Hermes sends context and shows reply
- [ ] Remind later schedules a local notification

## Docs

- [prd.md](prd.md) — product requirements
- [phases.md](phases.md) — implementation phases
- [PRODUCT.md](PRODUCT.md) — product truth
- [DESIGN.md](DESIGN.md) — visual system
- [docs/PRIVACY.md](docs/PRIVACY.md) — privacy
- [docs/HARDWARE.md](docs/HARDWARE.md) — compatibility matrix
