import { Platform } from 'react-native';
import { isOverlayHost, isSteroAssistantAvailable } from '../../../modules/stero-assistant/src';

let overlayModeCached: boolean | null = null;

/**
 * True when launched as Muse-style overlay host (no Home chrome).
 */
export function isOverlayLaunchIntent(url: string | null | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('overlay=1') ||
    lower.includes('overlay=true') ||
    lower.includes('stero_overlay')
  );
}

/**
 * Overlay chrome is only valid while the current activity is SteroHeadless.
 * Always re-probes — leftover activate URLs / cache must not grey out Main.
 */
export async function detectOverlayMode(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    overlayModeCached = false;
    return false;
  }

  if (isSteroAssistantAvailable()) {
    try {
      if (await isOverlayHost()) {
        overlayModeCached = true;
        return true;
      }
    } catch {
      // ignore
    }
  }

  overlayModeCached = false;
  try {
    (globalThis as { __STERO_OVERLAY__?: boolean }).__STERO_OVERLAY__ = false;
  } catch {
    // ignore
  }
  return false;
}

export function markOverlayMode(enabled: boolean): void {
  overlayModeCached = enabled;
  try {
    (globalThis as { __STERO_OVERLAY__?: boolean }).__STERO_OVERLAY__ = enabled;
  } catch {
    // ignore
  }
}

export function isOverlayModeSync(): boolean {
  return overlayModeCached === true;
}
