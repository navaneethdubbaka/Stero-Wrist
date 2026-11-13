import { create } from 'zustand';
import {
  createInitialSnapshot,
  reduceVoice,
  voiceStateLabel,
  type VoiceEvent,
  type VoiceMachineSnapshot,
  type VoiceState,
} from './voiceStateMachine';

type VoiceSessionState = {
  snapshot: VoiceMachineSnapshot;
  partialTranscript: string;
  dispatch: (event: VoiceEvent) => void;
  setPartial: (text: string) => void;
  reset: () => void;
  state: () => VoiceState;
  label: () => string;
};

export const useVoiceSessionStore = create<VoiceSessionState>((set, get) => ({
  snapshot: createInitialSnapshot(),
  partialTranscript: '',

  dispatch: (event) => {
    const next = reduceVoice(get().snapshot, event);
    if (__DEV__ && next.context.transitionLog.length) {
      const last =
        next.context.transitionLog[next.context.transitionLog.length - 1];
      // eslint-disable-next-line no-console
      console.log('[voice]', last);
    }
    set({
      snapshot: next,
      partialTranscript:
        event.type === 'ACTIVATE'
          ? ''
          : get().partialTranscript,
    });
  },

  setPartial: (text) => {
    set({ partialTranscript: text });
  },

  reset: () => {
    set({
      snapshot: createInitialSnapshot(),
      partialTranscript: '',
    });
  },

  state: () => get().snapshot.state,

  label: () => voiceStateLabel(get().snapshot.state),
}));
