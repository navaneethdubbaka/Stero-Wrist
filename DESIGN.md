# Design

<!-- impeccable:design-schema 1 -->

## Platform

adaptive

## World

Night harbor channel markers — status as lit lanterns along a dark water route. Operate mode: the world supplies type, palette, density, and one signature move only; navigation and controls stay platform-native (React Navigation stacks, switches, text fields).

## Signature move

**ChannelStrip** — a horizontal segmented lantern rail under the brand on Home: Assistant | Hermes | TTS | Notify. Green = ready, amber = pending/degraded, red = error, dim = off.

## Palette

| Token | Hex | Role |
|---|---|---|
| ink | `#0B1215` | App ground |
| surface | `#121C22` | Rows / blocks |
| surfaceRaised | `#1A2830` | Inputs |
| brandBand | `#0F3A42` | Shell / strip band |
| foam | `#E8F1F4` | Primary text |
| mist | `#9BB0BB` | Secondary text |
| outline | `#314650` | Borders |
| lanternReady | `#3DDC97` | Ready |
| lanternPending | `#E6B84D` | Pending |
| lanternError | `#E85D4C` | Error |
| lanternOff | `#5C6F78` | Off / inactive |

## Typography

System UI sans via React Native defaults. Roles: brand (22/700), headline (28/700 for active profile magnitude), title (20/700), body (16), label (13/600), caption (12).

## Density & layout

List-tight settings rows; Home is a single status composition (not a card dashboard). Touch targets ≥ 48dp. Safe-area aware.

## Surfaces

- **Home** — brand + ChannelStrip + profile magnitude + TTS/notify labels + placeholders; soft Set up Hermes only when zero profiles.
- **Settings** — native stack of list rows into profiles, webhook editor, assistant, TTS, notification stub, audio stub.

## Motion

None required in Phase 0–1 beyond native stack transitions. Honor Reduce Motion when motion is added later.

## Seed

seed:10450f5fa977e2b3 (Operate direction — harbor channel markers)
