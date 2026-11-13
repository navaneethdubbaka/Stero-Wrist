# Stero Wrist

Android / iOS companion app that turns a smartwatch into a voice + notification front-end for Hermes (and other AI backends).

**Phase 0–6 status:** Expo scaffold, Home + settings/profiles, phone-mic STT, Hermes webhook, system TTS, Android default-assistant + HFP mic, FCM registration + notification display.

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

3. Rebuild the **development client** (Expo Go is not enough for full FCM):

```powershell
robocopy "E:\Stero Wrist" E:\sw /MIR /XD .git .expo android\app\.cxx android\app\build android\build
cd E:\sw
npx expo prebuild --platform android
npx expo run:android
```

4. In the app: Settings → Notifications → set **Hermes device token URL** → enable FCM → **Register now**.
5. Hermes should POST to that URL with the device token (illustrative contract in Phase 6 code), then send FCM data/notification payloads with `type: "hermes_notification"`.

Voice webhook and FCM remain separate systems. **Notification Only** mode disables voice but keeps FCM when enabled.

### Manual FCM checklist

- [ ] `google-services.json` present; app rebuilt
- [ ] Device token URL set; Register now → Home Notify lantern **ready**
- [ ] App backgrounded → Hermes FCM push → system notification shown
- [ ] Malformed payload ignored (no crash)
- [ ] Token refresh re-registers with Hermes
- [ ] FCM off → lantern **off**; voice path unchanged

### Phase 2–5 voice (dev client)

STT: `expo-speech-recognition`. TTS: `expo-speech`. Watch button: `stero-assistant` VoiceInteraction + HFP/SCO.

Configure an active **backend profile** before Activate. Production builds reject `http://` webhook URLs; `__DEV__` allows them.

## Features so far

### Phase 1–5
- Home ChannelStrip, profiles, webhook, STT, system TTS, Android assistant role + mic routing, iOS `stero-wrist://activate`

### Phase 6
- `expo-notifications` + Firebase config files
- Device token → Hermes `deviceTokenUrl` (active profile auth)
- Priority Android channels / iOS categories
- Payload validation; `speak` ignored until Phase 7
- Live Home notify status

## Docs

- [prd.md](prd.md) — product requirements
- [phases.md](phases.md) — implementation phases
- [PRODUCT.md](PRODUCT.md) — product truth
- [DESIGN.md](DESIGN.md) — visual system
