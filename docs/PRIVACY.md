# Privacy — Stero Wrist

Stero Wrist is a personal AI companion on your phone. This document describes what the app processes and what it does **not** do.

## Data the app uses

| Data | Why | Where it goes |
|---|---|---|
| Microphone audio | Speech-to-text for assistant requests | Processed on-device by the OS speech recognizer; transcript text is sent only to **your** configured Hermes / webhook URL |
| Speech transcripts & replies | Voice session UX | Held in memory for the session; not uploaded to Stero servers (there are none) |
| Notification title/body | Inbox + optional spoken alerts | Stored in on-device SQLite; optional delivery acks go only to **your** ack URL |
| FCM / APNs device token | Push delivery | Stored in SecureStore; registered only to **your** Hermes device-token URL |
| Webhook / TTS API tokens | Auth to backends you configure | SecureStore only; never written to prefs JSON or debug exports |
| TTS gateway audio | Cloud voices (optional) | Text posted to **your** gateway URL; audio played locally |

## Defaults that protect privacy

- **No Stero cloud.** The app does not phone home. All network destinations are URLs you set (webhook, device token, ack, TTS gateway).
- **HTTPS required** outside development (`__DEV__`). Release builds reject `http://` for webhooks and TTS gateway.
- **Gateway-first TTS.** Prefer a server-side TTS gateway so OpenAI/Fish provider keys are not embedded in the app. On-device keys (if used) live in SecureStore and are warned as sensitive.
- **Payload minimization.** Settings → Notifications → *Store full notification body* can be turned off so the inbox keeps titles only.
- **Optional crash reporting.** If `EXPO_PUBLIC_SENTRY_DSN` is set and `@sentry/react-native` is installed, crashes may be sent with auth headers and token-like fields scrubbed. **Off by default** with no DSN.

## What we do not do

- Sell or share personal data
- Run analytics SDKs by default
- Keep a Stero-operated copy of mic audio, transcripts, or notifications
- Auto-retry voice queues after reconnect (no silent delayed execution)

## Permissions (OS)

- Microphone / speech recognition — assistant modes
- Notifications — FCM alerts
- Bluetooth (Android) — watch HFP mic routing
- Foreground service (Android) — short-lived mic session while listening

## Contact

For privacy questions about your Hermes deployment, contact your Hermes operator. This OSS companion does not operate a data service.
