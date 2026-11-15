import {
  dismissOverlay as nativeDismissOverlay,
  isSteroAssistantAvailable,
  setOverlayPhase as nativeSetOverlayPhase,
} from '../../../modules/stero-assistant/src';
import { isOverlayModeSync } from './overlayMode';

export type OverlayPhase =
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'idle'
  | 'error';

export async function setOverlayPhase(phase: OverlayPhase): Promise<void> {
  if (!isSteroAssistantAvailable()) return;
  if (!isOverlayModeSync() && phase !== 'idle') {
    // Still push phases when native orb is up (session may outlive sync flag race).
  }
  try {
    await nativeSetOverlayPhase(phase);
  } catch {
    // Native orb may already be gone.
  }
}

export async function dismissOverlay(): Promise<void> {
  if (!isSteroAssistantAvailable()) return;
  try {
    await nativeDismissOverlay();
  } catch {
    // ignore
  }
}

/** Map voice session machine state → orb phase. */
export function phaseForVoiceState(
  state: string,
): OverlayPhase | null {
  switch (state) {
    case 'LISTENING':
      return 'listening';
    case 'SENDING':
      return 'thinking';
    case 'SPEAKING':
      return 'speaking';
    case 'ERROR':
      return 'error';
    case 'IDLE':
      return 'idle';
    default:
      return null;
  }
}
