# Hardware compatibility — Stero Wrist

## Supported paths (v1)

| Platform | Activation | Mic | TTS output |
|---|---|---|---|
| **Android phone + HFP watch** | Default digital assistant role (watch button) or in-app Activate / `stero-wrist://activate` | Prefer watch HFP SCO when connected; phone mic fallback | Phone speaker (default); earbuds / Bluetooth best-effort after SCO teardown |
| **Android phone alone** | In-app / deep link | Phone mic | Phone speaker / BT / earbuds |
| **iOS phone** | Shortcuts / Action Button / Back Tap → `stero-wrist://activate` | Phone mic | System audio session after listen ends |

## Explicitly unsupported / best-effort

| Item | Status |
|---|---|
| Apple Watch mic as input | Unsupported in v1 |
| iOS default-assistant / SiriKit App Intents | Out of scope — Shortcuts deep link only |
| Guaranteed watch speaker for TTS | Not guaranteed — OS may not expose a watch speaker route; no OEM reverse-engineering |
| Expo Go | Insufficient — needs a **dev client / EAS build** for speech, FCM, SQLite, `stero-assistant` |
| Continuous STT on all OEMs | May be unavailable; app fails with a clear message and suggests Single Request |

## OEM / assistant quirks

- Some Android OEMs rename “default digital assistant” or hide the role under Voice input / Default apps. Use Settings → Default assistant in-app; if the role picker fails, open system Voice input settings.
- Aggressive battery savers may kill the mic foreground service — disable unrestricted battery for Stero Wrist when testing watch-button flows.
- Bluetooth HFP SCO can take ~300–500 ms to settle; the native helper waits briefly before STT starts.
- After TTS, Continuous mode re-prefers the input route so recognition can continue.

## Battery notes

- **Single Request / Conversation:** mic + SCO stop after each listen (Conversation restarts listen after reply).
- **Continuous:** recognition stays up until Cancel — higher battery; first enable shows an explicit warning.
- Notifications use **FCM only** (no WebSocket / polling).

## Matrix summary

```
Android phone + HFP watch  →  primary MVP path
Android phone alone        →  supported
iOS phone + Shortcut       →  supported (settings / webhook / TTS / FCM)
iOS Watch button           →  not supported (v1)
Watch speaker TTS          →  best-effort label only
```
