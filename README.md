# Stero Wrist

Android / iOS companion app that turns a smartwatch into a voice + notification front-end for Hermes (and other AI backends).

**Phase 0–7 status:** Expo scaffold, Home + settings/profiles, phone-mic STT, Hermes webhook, system TTS, Android default-assistant + HFP mic, FCM registration + display, priority-based notification speech.

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
npx expo start
```

### Firebase (Phase 6)

1. Create a Firebase project and add Android (`com.sterowrist.app`) / iOS apps.
2. Download config files and place them at the project root:

```powershell
copy google-services.json.example google-services.json
# replace with the real Firebase Android file

copy GoogleService-Info.plist.example GoogleService-Info.plist
# replace with the real Firebase iOS file
```

`app.config.js` wires `googleServicesFile` only when those files exist (they are gitignored).

3. Rebuild the **development client** (Expo Go is not enough for full FCM).

4. Settings → Notifications → set **Hermes device token URL** → enable FCM → **Register now**.

### Priority speech (Phase 7)

- Defaults: **critical/high speak**; **normal/low** display only.
- Quiet hours suppress speech (critical may still speak if enabled).
- Alerts **never cancel** a voice session. Critical can interrupt assistant TTS while `SPEAKING`; otherwise speech queues until Idle.
- Tap after auto-speak does **not** double-speak (`notification_id` dedupe).
- Payload `speak: false` suppresses speech even when the priority rule allows it.
- OS DND still owns channel sound; Android critical channel may bypass DND for display.

Manual checks:

- [ ] Critical while Idle → spoken
- [ ] High while Listening → spoken after Idle
- [ ] Critical while Speaking → interrupts TTS reply
- [ ] Quiet hours → high silent; critical speaks (exception on)
- [ ] Tap after auto-speak → no second utterance

### Phase 2–5 voice (dev client)

STT: `expo-speech-recognition`. TTS: `expo-speech`. Watch button: `stero-assistant` VoiceInteraction + HFP/SCO.

## Features so far

### Phase 1–6
- Home ChannelStrip, profiles, webhook, STT, system TTS, Android assistant role + mic routing, FCM token + channels

### Phase 7
- Per-priority notify/speak overrides, quiet hours, speech volume
- Session-aware notification speech queue + critical TTS interrupt
- Spoken-id dedupe (no double-speak on tap)

## Docs

- [prd.md](prd.md) — product requirements
- [phases.md](phases.md) — implementation phases
- [PRODUCT.md](PRODUCT.md) — product truth
- [DESIGN.md](DESIGN.md) — visual system
