import { AppState, Linking, Platform } from 'react-native';
import {
  addAssistantActivateListener,
  addAssistantOverlayCancelListener,
  consumePendingActivation,
  consumePendingOverlayCancel,
  isOverlayHost,
  isSteroAssistantAvailable,
} from '../../../modules/stero-assistant/src';
import { cancelVoiceSession, activateVoiceSession } from './VoiceSessionController';
import {
  isOverlayLaunchIntent,
  markOverlayMode,
} from './overlayMode';

async function markOverlayIfHeadless(): Promise<void> {
  if (!isSteroAssistantAvailable()) return;
  try {
    if (await isOverlayHost()) {
      markOverlayMode(true);
    }
  } catch {
    // MainActivity must never enter overlay chrome.
  }
}

let subscribed = false;
/** Dedup rapid cold-start: assistant event + overlay deeplink + pending. */
let lastActivateAt = 0;
const ACTIVATE_DEDUPE_MS = 3000;

function tryActivate(trigger: 'assistant' | 'deeplink'): void {
  const now = Date.now();
  if (now - lastActivateAt < ACTIVATE_DEDUPE_MS) return;
  lastActivateAt = now;
  void activateVoiceSession({ trigger });
}

function handleActivateUrl(url: string | null): void {
  if (!url) return;
  const lower = url.toLowerCase();
  if (
    lower.startsWith('stero-wrist://activate') ||
    lower.includes('://activate')
  ) {
    if (isOverlayLaunchIntent(url)) {
      void markOverlayIfHeadless();
    }
    tryActivate('deeplink');
  }
}

/**
 * Subscribe once at app boot: native VoiceInteraction + deep link → voice session.
 * Cold start: getInitialURL; warm: url events; iOS Shortcut/Action Button/Back Tap
 * all open stero-wrist://activate.
 */
export function startAssistantActivationListeners(): () => void {
  if (subscribed) {
    return () => undefined;
  }
  subscribed = true;

  const subs: Array<{ remove: () => void }> = [];

  if (isSteroAssistantAvailable()) {
    subs.push(
      addAssistantActivateListener(() => {
        void markOverlayIfHeadless();
        tryActivate('assistant');
      }),
    );

    subs.push(
      addAssistantOverlayCancelListener(() => {
        void cancelVoiceSession({ dismissOverlayUi: true });
      }),
    );

    void consumePendingActivation().then((pending) => {
      if (pending) {
        void markOverlayIfHeadless();
        tryActivate('assistant');
      }
    });

    void consumePendingOverlayCancel().then((pending) => {
      if (pending) {
        void cancelVoiceSession({ dismissOverlayUi: true });
      }
    });
  }

  const linkingSub = Linking.addEventListener('url', ({ url }) => {
    handleActivateUrl(url);
  });
  subs.push(linkingSub);

  // Cold start: process launch URL after JS is ready.
  void Linking.getInitialURL().then((url) => {
    handleActivateUrl(url ?? null);
  });

  // Some iOS cold-start paths deliver the URL slightly after getInitialURL null.
  if (Platform.OS === 'ios') {
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void Linking.getInitialURL().then((url) => {
          handleActivateUrl(url ?? null);
        });
      }
    });
    subs.push(appSub);
  }

  return () => {
    subscribed = false;
    for (const s of subs) s.remove();
  };
}
