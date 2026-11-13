# Stero Wrist

Android / iOS companion app that turns a smartwatch into a voice + notification front-end for Hermes (and other AI backends).

**Phase 0–5 status:** Expo scaffold, Home + settings/profiles, phone-mic STT, Hermes webhook, system TTS, Android default-assistant activation + HFP mic routing.

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
npx expo start
```

### Phase 2–5 — voice + Hermes + TTS + watch button (dev client)

STT uses **`expo-speech-recognition`**; TTS uses **`expo-speech`**; watch activation uses local module **`stero-assistant`** (`VoiceInteractionService` + HFP/SCO). Needs a **development client**, not Expo Go.

Configure an active **backend profile** (HTTPS webhook URL + token) before Activate. Production builds reject `http://` URLs; development allows them for local Hermes.

1. Enable Windows **LongPathsEnabled** if CMake `ninja mkdir` fails.
2. Prefer a **short path without spaces** for native builds:

```powershell
robocopy "E:\Stero Wrist" E:\sw /MIR /XD .git .expo android\app\.cxx android\app\build android\build
cd E:\sw
npx expo prebuild --platform android
npx expo run:android
```

3. On the device:
   - Settings → **Default assistant role** → set Stero Wrist as the default digital assistant.
   - Settings → Audio → input preference (`auto` / `watch` / `phone`).
   - **Activate assistant** (or press the watch assistant button) → speak → Hermes reply spoken on the **phone speaker**.
   - **Cancel** stops listening, SCO, and TTS.

Mic input and speaker output are independent; watch/earbud **output** is deferred to Phase 9.

### Android — watch button checklist

- [ ] Stero Wrist is the system default assistant.
- [ ] Phone locked / screen off → watch assistant button starts a session.
- [ ] Home shows mic source (`Mic: Watch HFP` or `Mic: Phone`).
- [ ] If HFP unavailable, banner **Using phone mic** and session still completes.
- [ ] Cancel mid-listen returns to Idle (never stuck in LISTENING).
- [ ] Role not set → soft Home prompt; in-app Activate still works on phone mic.

### iOS — Shortcut activation

iOS has no third-party default-assistant / watch-mic path in this phase.

1. Create a Shortcut: **Open URL** → `stero-wrist://activate`
2. Optionally bind it to the Action Button / Back Tap.
3. Opens the app and starts a phone-mic voice session.

## Features so far

### Phase 1
- Home **ChannelStrip** status; soft **Set up Hermes** when no profiles
- Backend profiles, webhook editor, SecureStore tokens, AsyncStorage prefs
- Assistant / TTS settings; notification stubs

### Phase 2
- Pure voice state machine (`IDLE → … → SPEAKING → IDLE`)
- Phone-mic STT via `expo-speech-recognition`
- Home **Activate assistant** / Cancel / transcript

### Phase 3
- Hermes webhook client (template, auth, timeout, retry, response mapping)
- Session IDs; HTTPS enforced outside `__DEV__`

### Phase 4
- System TTS (`expo-speech`) on phone speaker; stop on cancel / re-activate
- TTS **Test voice**; cloud providers fall back to system until Phase 9

### Phase 5
- Local Expo module `stero-assistant`: `VoiceInteractionService`, mic FGS, HFP/SCO routing
- Config plugin `plugins/withSteroAssistant.js` (manifest services + permissions)
- Settings → Default assistant role + Audio input enums + live route probe
- Home mic-source line + phone-mic fallback banner
- iOS: `stero-wrist://activate` deep link / Shortcut (phone mic only)

## Docs

- [prd.md](prd.md) — product requirements
- [phases.md](phases.md) — implementation phases
- [PRODUCT.md](PRODUCT.md) — product truth
- [DESIGN.md](DESIGN.md) — visual system
