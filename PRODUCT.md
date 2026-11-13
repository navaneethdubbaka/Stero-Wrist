# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Stack

delegated: Expo (dev client / prebuild) + React Native + TypeScript, React Navigation, Zustand, MMKV, SecureStore/Keychain — chosen in project plan for cross-platform Android/iOS with native module headroom. All project and heavy caches live on E: (`E:\Stero Wrist`, `E:\dev\...`).

## Users

Primary user is a solo Hermes power user configuring Stero Wrist on their own phone. They glance at connection status quickly (often while a smartwatch is paired) and configure webhook/TTS/assistant preferences when ready. Not a multi-admin or team dashboard audience.

## Product Purpose

Stero Wrist turns a compatible smartwatch into a wireless voice input and notification front-end for AI assistants (Hermes first). The phone app performs processing, networking, TTS, and settings. Success for v1 foundation: locked-phone watch-button voice to Hermes with spoken reply on the phone speaker, plus independent priority-aware FCM notifications.

Phase 0–1 success: user opens the app, understands status on Home, can create a Hermes backend profile with secure webhook credentials, and sees the active profile on Home after relaunch.

## Positioning

Watch is primarily an input device; phone is the brain and mouth. On-demand voice uses HTTP webhooks; proactive updates use FCM — separate channels. Backend- and TTS-provider agnostic so Hermes is the first backend, not a permanent architectural lock-in.

## Operating Context

- Phone app (React Native / Expo) as companion; smartwatch assistant button later for voice activation (Android-first).
- Hermes webhook URL + token configuration.
- Home-first first run: land on status; soft empty CTA to set up Hermes only when no profiles exist (no forced wizard).
- Later: STT, TTS playback, FCM, watch mic routing (out of Phase 0–1 scope).

## Capabilities and Constraints

**In Phase 0–1:** app scaffold; Home status shell; Settings hub; backend profile CRUD/switcher; webhook config UI; assistant/TTS local prefs; notification and audio stubs; secure token storage; persistence across relaunch.

**Out of Phase 0–1:** live webhook calls, STT, TTS playback, FCM, watch assistant button, conversation modes.

**Constraints:** Android microphone/assistant and iOS Siri/background limits apply later; HTTPS preferred for webhooks; never store tokens in plaintext prefs; disk policy — no heavy installs on C:.

## Brand Commitments

- Product name: **Stero Wrist**
- Primary integration name: Hermes (configurable; not the only future backend)

## Evidence on Hand

- [`prd.md`](prd.md) — product requirements and architecture
- [`phases.md`](phases.md) — React Native implementation phases
- No production screenshots, logos, or customer proof yet; synthetic demo status labels allowed if marked inactive/placeholder

## Product Principles

1. Status before setup — Home answers “am I ready?” before asking for configuration.
2. Watch inputs; phone processes and speaks.
3. Webhook conversations and FCM notifications stay separate systems.
4. Secrets never live in the APK or plaintext storage.
5. Provider adapters over hard-coded Hermes/TTS vendors.

## Accessibility & Inclusion

Follow platform accessibility expectations (Material on Android, HIG on iOS): minimum ~44–48dp touch targets, readable type scales, respect system Reduce Motion / Remove animations where motion is added later. No product-specific WCAG certification required yet.
