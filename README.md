# Stero Wrist

Android / iOS companion app that turns a smartwatch into a voice + notification front-end for Hermes (and other AI backends).

**Phase 0–3 status:** Expo scaffold, Home + settings/profiles, phone-mic STT, live Hermes webhook (TTS still stubbed until Phase 4).

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
npx expo start
```

### Phase 2–3 — voice + Hermes on a real device

STT uses **`expo-speech-recognition`** (platform SpeechRecognizer / SFSpeechRecognizer). It needs a **development client**, not Expo Go.

Configure an active **backend profile** (HTTPS webhook URL + token) before Activate. Phase 3 sends the transcript via HTTP and shows the mapped response. Production builds reject `http://` URLs; development allows them for local Hermes.

1. Enable Windows **LongPathsEnabled** if CMake `ninja mkdir` fails.
2. Prefer a **short path without spaces** for native builds:

```powershell
# Sync source to E:\sw then build/run from there
robocopy "E:\Stero Wrist" E:\sw /MIR /XD .git .expo android\app\.cxx android\app\build android\build
cd E:\sw
npx expo prebuild --platform android
# Ensure android/gradle.properties has newArchEnabled=false if CMake path length fails
npx expo run:android
```

3. On the device: open Stero Wrist → set up Hermes profile → **Activate assistant** → allow mic → speak → see transcript → Hermes reply → Idle. Failed sends offer **Retry last request**. **Cancel** returns to Idle.

Real TTS playback arrives in Phase 4.

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

## Docs

- [prd.md](prd.md) — product requirements
- [phases.md](phases.md) — implementation phases
- [PRODUCT.md](PRODUCT.md) — product truth
- [DESIGN.md](DESIGN.md) — visual system
