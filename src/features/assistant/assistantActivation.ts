import { Linking, Platform } from 'react-native';
import {
  addAssistantActivateListener,
  consumePendingActivation,
  isSteroAssistantAvailable,
} from '../../../modules/stero-assistant/src';
import { activateVoiceSession } from './VoiceSessionController';

let subscribed = false;

function handleActivateUrl(url: string | null): void {
  if (!url) return;
  const lower = url.toLowerCase();
  if (
    lower.startsWith('stero-wrist://activate') ||
    lower.includes('://activate')
  ) {
    void activateVoiceSession({ trigger: 'deeplink' });
  }
}

/**
 * Subscribe once at app boot: native VoiceInteraction + deep link → voice session.
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

  void Linking.getInitialURL().then((url) => {
    handleActivateUrl(url ?? null);
  });

  if (Platform.OS === 'ios') {
    // Shortcut / Action Button open the same URL scheme.
  }

  return () => {
    subscribed = false;
    for (const s of subs) s.remove();
  };
}
