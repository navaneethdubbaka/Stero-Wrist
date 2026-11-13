# Stero Wrist

Android / iOS companion app that turns a smartwatch into a voice + notification front-end for Hermes (and other AI backends).

**Phase 0–1 status:** Expo TypeScript scaffold, Home status shell, Settings + backend profiles with secure token storage.

## Disk layout (E:)

| Path | Use |
|---|---|
| `E:\Stero Wrist` | Project (Cursor workspace) |
| `E:\dev\Android\Sdk` | Android SDK |
| `E:\dev\gradle` | Gradle cache |
| `E:\dev\npm-cache` | npm cache |

Run once after reboot if env drifts:

```powershell
powershell -ExecutionPolicy Bypass -File "E:\Stero Wrist\scripts\setup-e-drive-env.ps1"
```

## Setup

```powershell
cd "E:\Stero Wrist"
npm install
npx tsc --noEmit
npx expo start
```

### Android native build note

Expo SDK 58 + New Architecture generates very deep CMake paths. On Windows this can fail with `ninja: error: mkdir(...): No such file or directory` unless:

1. **Windows long paths** are enabled (`LongPathsEnabled=1`), and/or
2. The project lives on a **short path without spaces** (e.g. `E:\sw` or rename to `E:\SteroWrist`).

A sync/build copy may exist at `E:\sw` for experiments. Source of truth remains this repo.

```powershell
npx expo prebuild --platform android
npx expo run:android
```

## Phase 1 features

- Home-first launch with **ChannelStrip** status (Assistant / Hermes / TTS / Notify)
- Soft **Set up Hermes** CTA only when no profiles exist
- Backend profile CRUD + active switcher
- Webhook editor (URL, auth, template, mapping, timeout/retry)
- Tokens / TTS API keys in **Expo SecureStore**
- Prefs in **AsyncStorage** (Expo-friendly; MMKV deferred until New Arch + long paths are solid)
- Assistant / TTS settings; Notification + Audio stubs

## Docs

- [prd.md](prd.md) — product requirements
- [phases.md](phases.md) — implementation phases
- [PRODUCT.md](PRODUCT.md) — Impeccable product truth
- [DESIGN.md](DESIGN.md) — visual system (after Phase 0–1 UI)
