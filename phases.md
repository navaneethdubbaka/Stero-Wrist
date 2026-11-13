# Stero Wrist — Implementation Phases (React Native)

**Project:** Stero Wrist  
**Stack decision:** React Native (cross-platform: Android + iOS)  
**Primary backend:** Hermes AI Assistant  
**Document status:** Implementation plan v1.0  
**Based on:** `prd.md`  
**Disk policy:** Everything heavy lives on **E:** — C: is low on space.

---

## Disk layout (E: only — mandatory)

C: is constrained. Do **not** scaffold, cache, or install SDKs onto C:.

| What | Path |
|---|---|
| Project root | `E:\Stero Wrist` |
| Android SDK | `E:\dev\Android\Sdk` |
| Gradle home | `E:\dev\gradle` |
| Expo cache | `E:\dev\expo` |
| npm cache | `E:\dev\npm-cache` |
| npm global prefix | `E:\npm-global` |
| Build temp | `E:\dev\temp` |
| node-gyp / misc caches | `E:\dev\node-gyp`, `E:\dev\caches` |

### One-time machine setup

```powershell
powershell -ExecutionPolicy Bypass -File "E:\Stero Wrist\scripts\setup-e-drive-env.ps1" -Migrate
```

Then **restart Cursor** so `ANDROID_HOME`, `GRADLE_USER_HOME`, npm cache, and TEMP point at E:.

Rules for every phase:

- Create the app only under `E:\Stero Wrist` (never `C:\Users\...\Projects`).
- Emulators / AVDs: store under `E:\dev\Android` when created.
- If Android Studio asks for SDK location, set `E:\dev\Android\Sdk`.
- Do not let Gradle or Expo silently recreate large caches under `%USERPROFILE%` on C: after setup (junctions + env vars prevent that).

---

## Why React Native

- One codebase for Android and iOS.
- Shared UI, settings, webhook client, TTS adapters, notification inbox, and state machine.
- Platform-specific work isolated in native modules / Expo modules for assistant activation, Bluetooth audio routing, and OS notification channels.

**Important constraint:** Smartwatch assistant-button behaviour differs by platform.

| Capability | Android | iOS |
|---|---|---|
| Watch assistant button → app | Android `VoiceInteractionService` / default assistant role | Limited; Siri Shortcuts / App Intents / WatchConnectivity paths |
| Bluetooth HFP mic from watch | Feasible with AudioManager / SCO | More restricted; validate per watch + iOS version |
| Background mic / locked screen | Assistant + FGS path | Strict background audio / Siri rules |
| FCM push | Full support | Use FCM via APNs (Firebase Messaging) |

**Strategy:** Ship Android-first for voice activation (matches PRD MVP), keep a shared JS core, then expand iOS voice paths as native capabilities allow. Notifications and settings should be cross-platform from early phases.

---

## Recommended stack

| Layer | Choice |
|---|---|
| Framework | React Native (New Architecture enabled) |
| Bootstrap | Expo (dev client / prebuild) — not Expo Go for production native modules |
| Language | TypeScript |
| UI | React Native + React Navigation |
| State | Zustand (or Redux Toolkit if team prefers) |
| Persistence | MMKV + encrypted storage for secrets |
| Networking | Axios or ky / fetch wrappers |
| STT | Platform SpeechRecognizer bridge; optional cloud STT adapter later |
| TTS | Provider interface → Android/iOS system TTS + OpenAI + Fish Audio + Custom HTTP |
| Push | `@react-native-firebase/messaging` |
| Local notifications | Notifee or `@react-native-firebase/messaging` display layer |
| Secure storage | `react-native-keychain` / Expo SecureStore |
| DI / modules | Plain TS modules + platform `.android.ts` / `.ios.ts` splits |
| Native bridges | Expo Modules API or Turbo Modules for assistant + audio routing |

---

## Phase overview

```text
Phase 0  Foundation & project scaffold
Phase 1  Shared app shell + settings + profiles
Phase 2  Voice state machine + STT (phone mic first)
Phase 3  Hermes webhook integration
Phase 4  System TTS + audio playback
Phase 5  Android assistant + smartwatch mic routing
Phase 6  FCM notifications + priority engine
Phase 7  Priority-based speech for notifications
Phase 8  Notification intelligence + inbox
Phase 9  Advanced modes + cloud TTS + iOS voice paths
Phase 10 Hardening, battery, security, release
```

Each phase below includes: goal, deliverables, technical notes, success criteria, and exit checklist.

---

# Phase 0 — Foundation & project scaffold

**Goal:** Create a stable React Native project that can host native modules and ship to both platforms.

### Deliverables

- [ ] Run `scripts/setup-e-drive-env.ps1 -Migrate` so SDK/caches live on **E:**.
- [ ] Confirm env: `ANDROID_HOME`, `GRADLE_USER_HOME`, `npm config get cache` all under `E:\`.
- [ ] Expo app with **dev client** / prebuild (not Expo Go–only), created **only** in `E:\Stero Wrist`.
- [ ] TypeScript strict config.
- [ ] Folder structure for features and platform code.
- [ ] ESLint / Prettier / basic CI lint job.
- [ ] Environment config pattern (`.env` + typed config; no secrets in repo).
- [ ] Android + iOS build scripts verified on real devices or emulators (AVDs on E:).
- [ ] README with setup steps (include E: disk policy).

### Suggested structure

```text
apps/mobile/   or project root
  src/
    app/                 # navigation, providers
    features/
      assistant/         # voice session, state machine
      webhook/           # Hermes HTTP client
      tts/               # providers + player
      notifications/     # FCM, priority, inbox
      settings/          # profiles, prefs
    shared/
      ui/
      storage/
      crypto/
      types/
    platform/
      assistant/
      audio/
      speech/
  modules/               # custom native modules (if needed)
```

### Technical notes

- Enable New Architecture early.
- Plan for custom native code from Phase 5; avoid libraries that block prebuild.
- Decide Firebase project ownership and package/bundle IDs now.

### Success criteria

App launches on Android and iOS with a blank shell and typed navigation.

### Exit checklist

- [ ] Tooling paths resolve under `E:\dev\...` (not `%USERPROFILE%` on C:).
- [ ] `android` / `ios` generate and build under `E:\Stero Wrist`.
- [ ] Typecheck passes.
- [ ] No secrets committed.

---

# Phase 1 — Shared app shell, settings, backend profiles

**Goal:** Build the configuration surface the rest of the app depends on.

### Deliverables

- [ ] Main home screen:
  - Assistant status
  - Current backend profile
  - Selected TTS engine
  - Notification connection status (placeholder until Phase 6)
  - Last interaction / recent notifications placeholders
  - Settings entry
- [ ] Settings sections (UI + persistence):
  - Assistant settings
  - Webhook settings
  - TTS settings (provider selection UI)
  - Notification settings (stubs OK)
  - Audio settings (stubs OK)
  - Backend profiles (CRUD)
- [ ] Secure credential storage for tokens / API keys.
- [ ] Typed settings schema + defaults.
- [ ] Profile switcher (Personal / Dev / Prod / Custom).

### Data model (initial)

```ts
type BackendProfile = {
  id: string;
  name: string;
  webhook: WebhookConfig;
  ttsProfileId?: string;
};

type WebhookConfig = {
  url: string;
  method: 'POST' | 'PUT';
  authType: 'none' | 'bearer' | 'api_key' | 'header';
  token?: string;
  headers: Record<string, string>;
  requestTemplate: string; // JSON template with {{text}} etc.
  responseMapping: { responsePath: string; sessionIdPath?: string };
  timeoutMs: number;
  retry: { maxAttempts: number; backoffMs: number };
};
```

### Success criteria

User can create a Hermes profile, save webhook URL + token securely, and see it on the home screen.

### Exit checklist

- [ ] Profiles persist across relaunch.
- [ ] Tokens readable only via secure storage APIs.
- [ ] Settings screens usable on phone-sized layouts.

---

# Phase 2 — Voice state machine + STT (phone microphone)

**Goal:** Implement the core voice interaction loop using the phone mic before tackling watch audio routing.

### Deliverables

- [ ] Voice state machine matching PRD:

```text
IDLE → ACTIVATED → LISTENING → TRANSCRIBING → SENDING
  → WAITING_RESPONSE → SPEAKING → IDLE
(+ ERROR → IDLE)
```

- [ ] Single Request mode (default).
- [ ] Configurable silence / end-of-utterance threshold (~1.2s initial).
- [ ] STT via platform speech recognition (phone mic).
- [ ] Visible UI states: Idle, Listening, Processing, Sending, Waiting, Speaking, Error.
- [ ] Manual “Activate assistant” button for development (watch button comes in Phase 5).
- [ ] Empty / noisy / cancelled utterance handling.

### Interaction modes (implement enum now; wire later)

| Mode | Phase |
|---|---|
| Single Request | Phase 2 |
| Conversation | Phase 9 |
| Continuous | Phase 9 |
| Notification Only | Phase 6 |

### Technical notes

- Keep the state machine pure (testable TS), with platform STT adapters.
- Do not assume watch mic works yet.
- Distinguish short pauses vs end-of-utterance; do not submit on brief silence alone without confidence heuristics.

### Success criteria

User taps Activate → speaks → sees final transcript in the UI → state returns to Idle (webhook stubbed or mocked).

### Exit checklist

- [ ] State transitions logged for debug.
- [ ] Cancel mid-listen returns to Idle cleanly.
- [ ] Works with screen on; lock-screen deferred to Phase 5.

---

# Phase 3 — Hermes webhook integration

**Goal:** Send transcribed text to Hermes and parse the response.

### Deliverables

- [ ] HTTP client using active backend profile.
- [ ] Request builder from configurable JSON template.
- [ ] Response field mapping (JSON path / key mapping).
- [ ] Auth: Bearer / API key / custom headers.
- [ ] Timeouts + retry policy.
- [ ] Error taxonomy:
  - Network unavailable
  - Timeout
  - 400 / 401 / 403 / 429 / 5xx
  - Invalid / empty / unexpected JSON
- [ ] Session ID support.
- [ ] Do **not** treat failed requests as successful answers.
- [ ] Optional “retry last transcript” with user confirmation.

### Example contract (adapt to real Hermes)

Request:

```json
{
  "text": "What is the status of my deployment?",
  "source": "stero-wrist",
  "session_id": "session-123",
  "mode": "single_request",
  "timestamp": "2026-11-12T14:30:00Z"
}
```

Response:

```json
{
  "response": "Your deployment completed successfully.",
  "session_id": "session-123"
}
```

### Success criteria

Spoken (or typed) request reaches Hermes; response text appears in the app.

### Exit checklist

- [ ] Works against a real Hermes webhook.
- [ ] Auth failures surface clear UX, not silent failure.
- [ ] HTTPS-only enforcement in production builds.

---

# Phase 4 — System TTS + audio playback

**Goal:** Speak Hermes responses through the phone speaker using a provider-independent TTS layer.

### Deliverables

- [ ] `TtsProvider` interface:

```ts
interface TtsProvider {
  synthesize(text: string, options: TtsOptions): Promise<AudioResult>;
}
```

- [ ] `SystemTtsProvider` (Android `TextToSpeech` / iOS `AVSpeechSynthesizer`).
- [ ] Shared audio player abstraction.
- [ ] Default output: **phone speaker**.
- [ ] TTS settings: voice, language, speed, test voice button.
- [ ] Per-event TTS policy stubs (assistant response vs notification priorities).
- [ ] Independent input vs output routing policy (document; enforce where OS allows).

### Explicitly deferred

- OpenAI TTS → Phase 9
- Fish Audio → Phase 9
- Custom HTTP TTS → Phase 9
- Watch speaker / earbuds routing UI → Phase 9 / 10

### Success criteria

Hermes response is spoken on the phone speaker via system TTS.

### Exit checklist

- [ ] Playback stops cleanly on cancel / new activation.
- [ ] Audio focus handled reasonably on Android and iOS.
- [ ] Provider switch in settings updates runtime behaviour.

---

# Phase 5 — Android assistant integration + smartwatch microphone

**Goal:** Make the watch assistant button activate Stero Wrist and capture speech from the watch mic when possible.

### Deliverables

#### Android (MVP-critical)

- [ ] Native module / Expo module wrapping assistant integration:
  - Default digital assistant / `VoiceInteractionService` path (or validated equivalent for RN)
  - Onboarding UI: “Set Stero Wrist as default assistant”
- [ ] Activation from smartwatch assistant button → JS voice session start.
- [ ] Bluetooth HFP / SCO investigation and explicit audio input routing.
- [ ] Verify actual recording device (do not assume SpeechRecognizer picks the watch).
- [ ] Fallback UX if watch mic unavailable (phone mic + clear error).
- [ ] Screen-off / lock-screen activation testing on target hardware.
- [ ] Foreground service declarations as required for mic capture.

#### iOS (parallel / best-effort in this phase)

- [ ] Document feasible activation paths (Siri Shortcut, Action Button, Watch app button, etc.).
- [ ] Implement at least one reliable iOS activation path (e.g. in-app / Shortcut).
- [ ] Flag watch-mic limitations honestly in settings / onboarding.

### Technical risks (validate on hardware)

| Risk | Mitigation |
|---|---|
| Watch button only opens Google Assistant / OEM assistant | Validate default-assistant role; document unsupported watches |
| SCO route fails silently | Probe route; surface “using phone mic” banner |
| RN bridge latency on activation | Keep native listen-start fast; hand off transcript ASAP |
| Lock-screen restrictions | Test on target phone + watch pairs early |

### Success criteria

**Android:** Phone locked → watch assistant button → speech captured (watch mic preferred) → transcript produced → existing webhook + TTS path completes → Idle.

### Exit checklist

- [ ] Hardware matrix tested (phone models × watch models).
- [ ] Mic source reported in debug UI.
- [ ] Failure modes never hang in LISTENING.

---

# Phase 6 — FCM registration + notification display

**Goal:** Receive proactive Hermes notifications without button activation.

### Deliverables

- [ ] Firebase project + Android / iOS app config.
- [ ] Device token registration and refresh handling.
- [ ] Secure association of device token with Hermes user / profile (backend endpoint).
- [ ] Parse illustrative payload:

```json
{
  "type": "hermes_notification",
  "notification_id": "notification-001",
  "title": "Deployment completed",
  "message": "Your voice agent was successfully deployed.",
  "priority": "normal",
  "speak": false,
  "timestamp": "2026-11-12T14:30:00Z",
  "source": "deployment_cron"
}
```

- [ ] Display Android / iOS notifications.
- [ ] Notification channels / categories by priority.
- [ ] Notification Only interaction mode (disable voice input, keep FCM).
- [ ] Home screen “notification connection” status live.
- [ ] Payload validation; ignore malformed messages.

### Success criteria

Hermes can push a notification to a backgrounded / idle app; user sees it without pressing the watch button.

### Exit checklist

- [ ] Token refresh re-registered with Hermes.
- [ ] Works on Android; iOS receives via APNs through FCM.
- [ ] Webhook voice path and FCM path remain separate systems.

---

# Phase 7 — Priority-based notification speech

**Goal:** Speak critical/high notifications according to user policy; keep normal/low silent by default.

### Deliverables

- [ ] Priority engine:

| Priority | Default notify | Default speak |
|---|---|---|
| Critical | Yes | Yes |
| High | Yes | Yes |
| Normal | Yes | No |
| Low | Quiet / grouped | No |

- [ ] User overrides per priority.
- [ ] Quiet hours + DND / Focus behaviour (respect OS where required).
- [ ] Critical alert exception toggles.
- [ ] Separate FCM **delivery** priority from app **presentation** priority.
- [ ] Speak using selected TTS provider; do not fight an active voice session (queue / interrupt policy).
- [ ] Speech volume + interruption settings.

### Success criteria

Critical/high messages are spoken per settings; normal/low remain notifications only.

### Exit checklist

- [ ] Simultaneous voice session + incoming critical alert behaviour defined and tested.
- [ ] Quiet hours verified.
- [ ] No double-speak on notification tap + auto-speak.

---

# Phase 8 — Notification intelligence + inbox

**Goal:** Make notifications usable over time, not just popups.

### Deliverables

- [ ] Notification inbox (Room-equivalent: SQLite / WatermelonDB / MMKV+index — prefer SQLite for query/filter).
- [ ] Fields: title, message, priority, source, timestamp, delivery status, spoken status, acknowledgement.
- [ ] Filters: All / Critical / High / Normal / Low / Unread / Acknowledged.
- [ ] Duplicate suppression via `notification_id` (+ optional dedupe key).
- [ ] Batching summaries (e.g. “Five tasks completed…”).
- [ ] Actions: Acknowledge, Dismiss, Remind later, Ask Hermes, Open details.
- [ ] Contextual follow-up webhook payload:

```json
{
  "text": "Tell me more about the server alert.",
  "source": "stero-wrist",
  "context": { "notification_id": "notification-002" }
}
```

- [ ] Backend acknowledgement hooks (device received / displayed / spoken / acked) as optional API.

### Success criteria

User can review history, suppress duplicates, acknowledge items, and ask Hermes about a specific notification with context.

### Exit checklist

- [ ] Inbox searchable / filterable.
- [ ] Deduped alerts are not re-spoken.
- [ ] Sensitive actions still require confirmation (policy stub OK).

---

# Phase 9 — Advanced modes, cloud TTS, multi-profile polish, iOS voice expansion

**Goal:** Expand beyond MVP into full PRD “Later” capabilities.

### Deliverables

#### Voice modes

- [ ] Conversation mode (auto-listen after response).
- [ ] Continuous mode (segment multiple utterances).
- [ ] Respect OS mic / background limits; degrade gracefully.

#### Cloud TTS

- [ ] `OpenAITtsProvider`
- [ ] `FishAudioTtsProvider`
- [ ] `CustomHttpTtsProvider`
- [ ] Preferred architecture: app → TTS Gateway → provider (keys stay off-device when possible)
- [ ] Per-event TTS engine mapping (response vs critical vs normal vs silent)

#### Profiles & audio

- [ ] Full multi-profile TTS overrides.
- [ ] Output device selection: phone speaker / earbuds / other BT (watch speaker if supported).
- [ ] Independent input/output route controls in UI.

#### iOS

- [ ] Stronger Watch / Siri activation path if feasible.
- [ ] Document unsupported OEM behaviours.

### Success criteria

User can run Conversation mode on supported platforms, pick a cloud voice, and keep Android watch-button flow stable.

### Exit checklist

- [ ] Cloud TTS failures fall back to system TTS.
- [ ] Continuous mode is opt-in and clearly battery-warninged.
- [ ] Provider adapters share one player pipeline.

---

# Phase 10 — Hardening, battery, security, release

**Goal:** Production readiness for Stero Wrist v1.0 foundation (MVP + selected Phase 8/9 items as scoped).

### Deliverables

- [ ] Battery review:
  - No permanent WebSocket for notifications
  - Mic only when required
  - Release audio resources after each request
  - No polling loops
- [ ] Security review:
  - HTTPS everywhere
  - Encrypted credentials
  - No provider secrets in binary
  - No auth header logging
  - Notification payload minimization
  - Mic activation only on user/assistant intent
- [ ] Offline behaviour:
  - Speak/display connectivity errors
  - Retain transcript for manual retry only (no silent delayed execution)
- [ ] Crash / analytics (privacy-preserving)
- [ ] Hardware compatibility matrix published
- [ ] Store listing assets + privacy policy text for mic / notifications
- [ ] Versioned release builds (Play Store; TestFlight / App Store as iOS readiness allows)

### Definition of Done (aligned with PRD §22)

**Voice:** Locked phone → watch button (Android) → STT → Hermes webhook → TTS → phone speaker → Idle.

**Notifications:** Hermes cron → FCM → priority rules → display / optional speak → reviewable history.

### Exit checklist

- [ ] MVP must-haves from PRD §19 complete on Android.
- [ ] iOS: settings + webhook + TTS + FCM solid; voice activation documented for what works.
- [ ] Known risks and unsupported devices listed in-app or docs.

---

## MVP mapping (PRD §19 → phases)

| Must have | Phase |
|---|---|
| Project / app shell | 0–1 |
| Default assistant integration (Android) | 5 |
| Smartwatch assistant button activation | 5 |
| Bluetooth microphone input | 5 |
| Single Request mode | 2 |
| Speech-to-text | 2 |
| Configurable Hermes webhook | 3 |
| Receive webhook response | 3 |
| System / built-in TTS | 4 |
| Phone-speaker playback | 4 |
| FCM device registration | 6 |
| Receive Hermes push notifications | 6 |
| Priority-based notification handling | 7 |
| Speak critical / high | 7 |
| Display normal / low | 6–7 |
| Basic settings | 1 |

| Later | Phase |
|---|---|
| OpenAI / Fish / Custom TTS | 9 |
| Notification inbox | 8 |
| Batching / ack / escalation | 8 |
| Context-aware conversations | 8 |
| Multiple assistant profiles (full) | 1 (basic) → 9 (polish) |
| Advanced voice modes | 9 |

---

## Cross-cutting engineering rules

1. **Watch is input; phone is brain and mouth.**
2. **Webhook ≠ FCM.** Keep channels separate in code modules.
3. **Provider adapters everywhere** (STT, TTS, webhook backends).
4. **Platform files for native differences** (`.android.ts` / `.ios.ts` + native modules).
5. **Test on real watch + phone pairs every phase that touches audio or assistant activation.**
6. **Feature-flag** Conversation / Continuous / cloud TTS until stable.
7. **Do not auto-run stale queued voice commands** after reconnect.

---

## Suggested milestone order for the team

1. Finish Phases **0 → 4** on phone-only activation (fast feedback with Hermes).
2. Tackle Phase **5** on target Android watch hardware next (highest risk).
3. Land Phases **6 → 7** for proactive Hermes value.
4. Add Phase **8** inbox intelligence.
5. Expand Phase **9** cloud voices + advanced modes + iOS voice paths.
6. Close with Phase **10** release hardening.

---

## Open decisions to resolve during Phase 0–1

- [ ] Expo Modules vs bare Turbo Modules for assistant service.
- [ ] Exact Hermes webhook request/response schema (replace illustrative contract).
- [ ] Whether cloud TTS keys live only on a TTS Gateway in v1.
- [ ] Target watch list for Phase 5 validation.
- [ ] iOS v1 scope: notifications-only vs Shortcut-based voice.

---

*This plan supersedes the Kotlin-only phasing in `prd.md` §18 for implementation sequencing, while preserving product goals, channels, and definition of done.*
