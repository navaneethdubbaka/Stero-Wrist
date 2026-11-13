import type { AudioInputPreference } from '../../shared/types/settings';

export type InputRouteKind = 'watch_hfp' | 'phone' | 'unknown';

export type ActiveInputInfoLike = {
  label: string;
  kind: InputRouteKind;
  scoOn: boolean;
  hfpAvailable: boolean;
};

export type RouteDecision = {
  preferWatch: boolean;
  expectedKind: InputRouteKind;
  usingPhoneFallback: boolean;
  banner: string | null;
};

/**
 * Pure policy: settings + HFP availability → whether to start SCO and what UI to show.
 * Native AudioRouteHelper still probes the real device after start.
 */
export function decideInputRoute(
  preference: AudioInputPreference,
  hfpAvailable: boolean,
): RouteDecision {
  if (preference === 'phone') {
    return {
      preferWatch: false,
      expectedKind: 'phone',
      usingPhoneFallback: false,
      banner: null,
    };
  }

  if (preference === 'watch') {
    if (!hfpAvailable) {
      return {
        preferWatch: false,
        expectedKind: 'phone',
        usingPhoneFallback: true,
        banner: 'Watch mic unavailable — using phone mic',
      };
    }
    return {
      preferWatch: true,
      expectedKind: 'watch_hfp',
      usingPhoneFallback: false,
      banner: null,
    };
  }

  // auto
  if (hfpAvailable) {
    return {
      preferWatch: true,
      expectedKind: 'watch_hfp',
      usingPhoneFallback: false,
      banner: null,
    };
  }
  return {
    preferWatch: false,
    expectedKind: 'phone',
    usingPhoneFallback: true,
    banner: 'Using phone mic',
  };
}

export function formatMicSourceLabel(info: ActiveInputInfoLike | null): string {
  if (!info) return 'Mic: unknown';
  if (info.kind === 'watch_hfp') {
    return `Mic: ${info.label || 'Watch HFP'}`;
  }
  if (info.kind === 'phone') {
    return `Mic: ${info.label || 'Phone'}`;
  }
  return `Mic: ${info.label || 'Unknown'}`;
}

export function shouldPreferWatch(
  preference: AudioInputPreference,
  hfpAvailable: boolean,
): boolean {
  return decideInputRoute(preference, hfpAvailable).preferWatch;
}

/** Normalize legacy persisted values (`default` → `auto`). */
export function normalizeInputPreference(
  value: string | undefined,
): AudioInputPreference {
  if (value === 'watch' || value === 'phone' || value === 'auto') return value;
  return 'auto';
}
