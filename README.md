# Stero Wrist

Android / iOS companion app that turns a smartwatch into a voice + notification front-end for Hermes (and other AI backends).

**Phase 0–4 status:** Expo scaffold, Home + settings/profiles, phone-mic STT, Hermes webhook, system TTS on the phone speaker.

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
npx expo start
```

### Phase 2–4 — voice + Hermes + TTS on a real device

STT uses **`expo-speech-recognition`**; TTS uses **`expo-speech`** (system voices). Needs a **development client**, not Expo Go.

Configure an active **backend profile** (HTTPS webhook URL + token) before Activate. Production builds reject `http://` URLs; development allows them for local Hermes.

1. Enable Windows **LongPathsEnabled** if CMake `ninja mkdir` fails.
2. Prefer a **short path without spaces** for native builds:

```powershell
robocopy "E:\Stero Wrist" E:\sw /MIR /XD .git .expo android\app\.cxx android\app\build android\build
cd E:\sw
npx expo prebuild --platform android
npx expo run:android
```

3. On the device: set up Hermes → **Activate assistant** → speak → transcript → Hermes reply **spoken** on the phone speaker → Idle. **Cancel** stops listening and TTS. Settings → TTS → **Test voice** previews the current voice/language/speed.

Mic input and speaker output are independent; watch/earbud routing is deferred.

### Android native build note

Deep New Architecture CMake paths often break on Windows (`ninja: error: mkdir(...): No such file or directory`). Mitigations: long paths + short project path + `newArchEnabled=false` in `gradle.properties` when needed.

## Features so far

### Phase 1
- Home **ChannelStrip** status; soft **Set up Hermes** when no profiles
- Backend profiles, webhook editor, SecureStore tokens, AsyncStorage prefs
- Assistant / TTS settings; notification + audio stubs

### Phase 2
- Pure voice state machine (`IDLE → … → SPEAKING → IDLE`)
- Phone-mic STT via `expo-speech-recognition`
- Home **Activate assistant** / Cancel / transcript
- Silence threshold from Assistant settings (Android RecognizerIntent)

### Phase 3
- Hermes webhook client (template, auth, timeout, retry, response mapping)
- Session IDs; HTTPS enforced outside `__DEV__`
- Home shows real **Last reply**; **Retry last request** on send failures

### Phase 4
- `TtsProvider` + **System TTS** (`expo-speech`) on phone speaker
- Speaks Hermes replies; stop on cancel / re-activate
- TTS settings **Test voice**; cloud providers fall back to system until Phase 9
- Per-event TTS policy stubs (notifications unused until Phase 7)

## Docs

- [prd.md](prd.md) — product requirements
- [phases.md](phases.md) — implementation phases
- [PRODUCT.md](PRODUCT.md) — product truth
- [DESIGN.md](DESIGN.md) — visual system
