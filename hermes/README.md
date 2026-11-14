# Stero Hermes service

Node 20+ TypeScript gateway for the Stero Wrist app. Copy `.env.example` to `.env`, set the required Hermes credentials and app token, then run `npm install` and `npm start`.

`POST /voice`, `/devices`, `/ack`, and `/tts` require `Authorization: Bearer <HERMES_APP_TOKEN>`. `GET /health` and the Hermes-originated `POST /notifications` do not.

The TTS route forwards the exact app gateway request (`provider`, `text`, `voice`, `model`, `language`, `speed`, and `voice_reference_id`) and transparently returns JSON audio responses or audio bytes from `TTS_BASE_URL`.

Push delivery is intentionally not implemented. `PUSH_SENDER=noop` logs and records payloads in memory; replace the `PushSender` implementation when FCM or Expo push delivery is introduced.
