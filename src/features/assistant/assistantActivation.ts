import { AppState, Linking, Platform } from 'react-native';
import {
  addAssistantActivateListener,
  consumePendingActivation,
  isSteroAssistantAvailable,
} from '../../../modules/stero-assistant/src';
import { activateVoiceSession } from './VoiceSessionController';

let subscribed = false;
/** Dedup rapid cold-start + url event double fire. */
let lastActivateAt = 0;

function handleActivateUrl(url: string | null): void {
  if (!url) return;
  const lower = url.toLowerCase();
  if (
    lower.startsWith('stero-wrist://activate') ||
    lower.includes('://activate')
  ) {
    const now = Date.now();
    if (now - lastActivateAt < 800) return;
    lastActivateAt = now;
    void activateVoiceSession({ trigger: 'deeplink' });
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
        void activateVoiceSession({ trigger: 'assistant' });
      }),
    );

    void consumePendingActivation().then((pending) => {
      if (pending) {
        void activateVoiceSession({ trigger: 'assistant' });
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
