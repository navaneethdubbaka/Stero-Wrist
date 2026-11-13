import { create } from 'zustand';
import {
  createInitialSnapshot,
  reduceVoice,
  voiceStateLabel,
  type VoiceEvent,
  type VoiceMachineSnapshot,
  type VoiceState,
} from './voiceStateMachine';

type MicRouteUi = {
  label: string | null;
  banner: string | null;
};

type VoiceSessionState = {
  snapshot: VoiceMachineSnapshot;
  partialTranscript: string;
  micRoute: MicRouteUi;
  dispatch: (event: VoiceEvent) => void;
  setPartial: (text: string) => void;
  setMicRoute: (route: MicRouteUi) => void;
  reset: () => void;
  state: () => VoiceState;
  label: () => string;
};

export const useVoiceSessionStore = create<VoiceSessionState>((set, get) => ({
  snapshot: createInitialSnapshot(),
  partialTranscript: '',
  micRoute: { label: null, banner: null },

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

  setMicRoute: (route) => {
    set({ micRoute: route });
  },

  reset: () => {
    set({
      snapshot: createInitialSnapshot(),
      partialTranscript: '',
      micRoute: { label: null, banner: null },
    });
  },

  state: () => get().snapshot.state,

  label: () => voiceStateLabel(get().snapshot.state),
}));
