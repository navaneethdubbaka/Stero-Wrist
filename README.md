# Stero Wrist

Android / iOS companion app that turns a smartwatch into a voice + notification front-end for Hermes (and other AI backends).

**Phase 0–8 status:** Scaffold through FCM + priority speech, plus SQLite notification inbox (filters, dedupe, batching, Ask Hermes with context).

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
npx expo start
```

Dev client rebuild required for native modules (`expo-sqlite`, FCM, speech, assistant).

### Firebase + FCM (Phase 6)

Copy real `google-services.json` / `GoogleService-Info.plist` from the `*.example` files, then rebuild. Settings → Notifications → device token URL → Register now.

### Priority speech (Phase 7)

Critical/high speak by default; quiet hours; session-aware queue (critical can interrupt TTS). Tap after auto-speak does not double-speak.

### Inbox (Phase 8)

- Home **Recent notifications** / Settings → **Notification inbox**
- Filters: All / Critical / High / Normal / Low / Unread / Acknowledged + search
- Duplicate `notification_id` or `dedupe_key` → no re-speak
- ≥3 same `source` within 10 minutes → batch summary row
- Detail actions: Acknowledge, Dismiss (confirm), Remind later, Ask Hermes (confirm + webhook `context.notification_id`)
- Optional **Delivery ack URL** for received/displayed/spoken/acked/dismissed

Manual checks:

- [ ] Duplicate FCM id not re-spoken
- [ ] Filter Unread / search works
- [ ] Acknowledge + Dismiss
- [ ] Ask Hermes sends context and shows reply
- [ ] Remind later schedules a local notification

## Features so far

### Phase 1–7
- ChannelStrip, profiles, webhook, STT, system TTS, Android assistant + HFP, FCM, priority speech

### Phase 8
- `expo-sqlite` inbox, durable spoken IDs, batching, Ask Hermes context, optional ack hooks

## Docs

- [prd.md](prd.md) — product requirements
- [phases.md](phases.md) — implementation phases
- [PRODUCT.md](PRODUCT.md) — product truth
- [DESIGN.md](DESIGN.md) — visual system
