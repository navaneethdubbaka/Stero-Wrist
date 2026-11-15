import { useSettingsStore } from '../settings/settingsStore';
import { dismissOverlay, phaseForVoiceState, setOverlayPhase } from './overlayBridge';
import { useVoiceSessionStore } from './voiceSessionStore';

/**
 * Mirror voice session state onto the native Muse-style orb.
 * Dismisses the overlay shortly after returning to IDLE (successful turn end),
 * except continuous mode (stays listening) and conversation (re-enters LISTENING).
 */
export function startOverlayPhaseSync(): () => void {
  let lastPhase: string | null = null;
  let dismissTimer: ReturnType<typeof setTimeout> | null = null;
  let speakingSeen = false;
  let listeningSeen = false;

  const unsub = useVoiceSessionStore.subscribe((s) => {
    const state = s.snapshot.state;
    const phase = phaseForVoiceState(state);
    if (!phase || phase === lastPhase) {
      if (state === 'SPEAKING') speakingSeen = true;
      return;
    }
    lastPhase = phase;
    if (state === 'SPEAKING') speakingSeen = true;
    void setOverlayPhase(phase);

    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }

    const mode = useSettingsStore.getState().settings.assistant.defaultMode;

    // Continuous keeps the orb up while the mic stays open.
    if (mode === 'continuous' && (phase === 'listening' || phase === 'idle')) {
      return;
    }

    // After a completed speak → idle, close orb if conversation does not resume listen.
    if (phase === 'idle' && speakingSeen) {
      dismissTimer = setTimeout(() => {
        const now = useVoiceSessionStore.getState().snapshot.state;
        if (now === 'IDLE' || now === 'LISTENING') {
          if (now === 'LISTENING') return;
          void dismissOverlay();
          speakingSeen = false;
          listeningSeen = false;
        }
      }, 900);
    }

    // no-speech / cancel after listen — close orb (don't leave ✕ + Listening stuck).
    if (phase === 'idle' && listeningSeen && !speakingSeen) {
      dismissTimer = setTimeout(() => {
        const now = useVoiceSessionStore.getState().snapshot.state;
        if (now === 'IDLE') {
          void dismissOverlay();
          listeningSeen = false;
        }
      }, 500);
    }

    // Keep the orb up on error so the user can read status / tap X.
    // (Auto-dismiss was closing the overlay during permission / STT races.)
    if (phase === 'error') {
      // no auto-dismiss
    }

    if (phase === 'listening') {
      speakingSeen = false;
      listeningSeen = true;
    }
  });

  // Seed current state.
  const initial = phaseForVoiceState(
    useVoiceSessionStore.getState().snapshot.state,
  );
  if (initial) {
    lastPhase = initial;
    void setOverlayPhase(initial);
  }

  return () => {
    unsub();
    if (dismissTimer) clearTimeout(dismissTimer);
  };
}
