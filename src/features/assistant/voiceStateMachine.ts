export type VoiceState =
  | 'IDLE'
  | 'ACTIVATED'
  | 'LISTENING'
  | 'TRANSCRIBING'
  | 'SENDING'
  | 'WAITING_RESPONSE'
  | 'SPEAKING'
  | 'ERROR';

export type VoiceEvent =
  | { type: 'ACTIVATE' }
  | { type: 'STT_STARTED' }
  | { type: 'SPEECH_ENDED' }
  | { type: 'TRANSCRIPT_FINAL'; transcript: string }
  | { type: 'TRANSCRIPT_EMPTY' }
  | { type: 'CANCEL' }
  | { type: 'MOCK_SENT' }
  | { type: 'MOCK_REPLY'; reply: string }
  | { type: 'MOCK_SPEAK_DONE' }
  | { type: 'FAIL'; message: string }
  | { type: 'DISMISS_ERROR' };

export type VoiceMachineContext = {
  partialTranscript: string;
  finalTranscript: string;
  lastReply: string;
  errorMessage: string | null;
  transitionLog: string[];
};

export type VoiceMachineSnapshot = {
  state: VoiceState;
  context: VoiceMachineContext;
};

export function createInitialContext(): VoiceMachineContext {
  return {
    partialTranscript: '',
    finalTranscript: '',
    lastReply: '',
    errorMessage: null,
    transitionLog: [],
  };
}

export function createInitialSnapshot(): VoiceMachineSnapshot {
  return {
    state: 'IDLE',
    context: createInitialContext(),
  };
}

function logTransition(
  context: VoiceMachineContext,
  from: VoiceState,
  event: VoiceEvent['type'],
  to: VoiceState,
): VoiceMachineContext {
  const entry = `${from} --${event}--> ${to}`;
  return {
    ...context,
    transitionLog: [...context.transitionLog.slice(-49), entry],
  };
}

/**
 * Pure voice interaction state machine (Single Request).
 * Side effects (STT, network, TTS) live outside this reducer.
 */
export function reduceVoice(
  snapshot: VoiceMachineSnapshot,
  event: VoiceEvent,
): VoiceMachineSnapshot {
  const { state, context } = snapshot;

  switch (state) {
    case 'IDLE': {
      if (event.type === 'ACTIVATE') {
        const next: VoiceState = 'ACTIVATED';
        return {
          state: next,
          context: logTransition(
            {
              ...context,
              partialTranscript: '',
              finalTranscript: '',
              errorMessage: null,
            },
            state,
            event.type,
            next,
          ),
        };
      }
      return snapshot;
    }

    case 'ACTIVATED': {
      if (event.type === 'STT_STARTED') {
        const next: VoiceState = 'LISTENING';
        return {
          state: next,
          context: logTransition(context, state, event.type, next),
        };
      }
      if (event.type === 'CANCEL') {
        const next: VoiceState = 'IDLE';
        return {
          state: next,
          context: logTransition(context, state, event.type, next),
        };
      }
      if (event.type === 'FAIL') {
        const next: VoiceState = 'ERROR';
        return {
          state: next,
          context: logTransition(
            { ...context, errorMessage: event.message },
            state,
            event.type,
            next,
          ),
        };
      }
      return snapshot;
    }

    case 'LISTENING': {
      if (event.type === 'SPEECH_ENDED') {
        const next: VoiceState = 'TRANSCRIBING';
        return {
          state: next,
          context: logTransition(context, state, event.type, next),
        };
      }
      if (event.type === 'TRANSCRIPT_FINAL') {
        const trimmed = event.transcript.trim();
        if (!trimmed) {
          const next: VoiceState = 'IDLE';
          return {
            state: next,
            context: logTransition(
              {
                ...context,
                partialTranscript: '',
                finalTranscript: '',
                errorMessage: 'No speech detected.',
              },
              state,
              'TRANSCRIPT_EMPTY',
              next,
            ),
          };
        }
        const next: VoiceState = 'SENDING';
        return {
          state: next,
          context: logTransition(
            {
              ...context,
              partialTranscript: trimmed,
              finalTranscript: trimmed,
              errorMessage: null,
            },
            state,
            event.type,
            next,
          ),
        };
      }
      if (event.type === 'TRANSCRIPT_EMPTY') {
        const next: VoiceState = 'IDLE';
        return {
          state: next,
          context: logTransition(
            {
              ...context,
              partialTranscript: '',
              finalTranscript: '',
              errorMessage: 'No speech detected.',
            },
            state,
            event.type,
            next,
          ),
        };
      }
      if (event.type === 'CANCEL') {
        const next: VoiceState = 'IDLE';
        return {
          state: next,
          context: logTransition(
            {
              ...context,
              partialTranscript: '',
              errorMessage: null,
            },
            state,
            event.type,
            next,
          ),
        };
      }
      if (event.type === 'FAIL') {
        const next: VoiceState = 'ERROR';
        return {
          state: next,
          context: logTransition(
            { ...context, errorMessage: event.message },
            state,
            event.type,
            next,
          ),
        };
      }
      return snapshot;
    }

    case 'TRANSCRIBING': {
      if (event.type === 'TRANSCRIPT_FINAL') {
        const trimmed = event.transcript.trim();
        if (!trimmed) {
          const next: VoiceState = 'IDLE';
          return {
            state: next,
            context: logTransition(
              {
                ...context,
                partialTranscript: '',
                finalTranscript: '',
                errorMessage: 'No speech detected.',
              },
              state,
              'TRANSCRIPT_EMPTY',
              next,
            ),
          };
        }
        const next: VoiceState = 'SENDING';
        return {
          state: next,
          context: logTransition(
            {
              ...context,
              partialTranscript: trimmed,
              finalTranscript: trimmed,
              errorMessage: null,
            },
            state,
            event.type,
            next,
          ),
        };
      }
      if (event.type === 'TRANSCRIPT_EMPTY') {
        const next: VoiceState = 'IDLE';
        return {
          state: next,
          context: logTransition(
            {
              ...context,
              partialTranscript: '',
              finalTranscript: '',
              errorMessage: 'No speech detected.',
            },
            state,
            event.type,
            next,
          ),
        };
      }
      if (event.type === 'CANCEL') {
        const next: VoiceState = 'IDLE';
        return {
          state: next,
          context: logTransition(context, state, event.type, next),
        };
      }
      if (event.type === 'FAIL') {
        const next: VoiceState = 'ERROR';
        return {
          state: next,
          context: logTransition(
            { ...context, errorMessage: event.message },
            state,
            event.type,
            next,
          ),
        };
      }
      return snapshot;
    }

    case 'SENDING': {
      if (event.type === 'MOCK_SENT') {
        const next: VoiceState = 'WAITING_RESPONSE';
        return {
          state: next,
          context: logTransition(context, state, event.type, next),
        };
      }
      if (event.type === 'FAIL') {
        const next: VoiceState = 'ERROR';
        return {
          state: next,
          context: logTransition(
            { ...context, errorMessage: event.message },
            state,
            event.type,
            next,
          ),
        };
      }
      if (event.type === 'CANCEL') {
        const next: VoiceState = 'IDLE';
        return {
          state: next,
          context: logTransition(context, state, event.type, next),
        };
      }
      return snapshot;
    }

    case 'WAITING_RESPONSE': {
      if (event.type === 'MOCK_REPLY') {
        const next: VoiceState = 'SPEAKING';
        return {
          state: next,
          context: logTransition(
            { ...context, lastReply: event.reply },
            state,
            event.type,
            next,
          ),
        };
      }
      if (event.type === 'FAIL') {
        const next: VoiceState = 'ERROR';
        return {
          state: next,
          context: logTransition(
            { ...context, errorMessage: event.message },
            state,
            event.type,
            next,
          ),
        };
      }
      if (event.type === 'CANCEL') {
        const next: VoiceState = 'IDLE';
        return {
          state: next,
          context: logTransition(context, state, event.type, next),
        };
      }
      return snapshot;
    }

    case 'SPEAKING': {
      if (event.type === 'MOCK_SPEAK_DONE') {
        const next: VoiceState = 'IDLE';
        return {
          state: next,
          context: logTransition(context, state, event.type, next),
        };
      }
      if (event.type === 'CANCEL') {
        const next: VoiceState = 'IDLE';
        return {
          state: next,
          context: logTransition(context, state, event.type, next),
        };
      }
      return snapshot;
    }

    case 'ERROR': {
      if (event.type === 'DISMISS_ERROR' || event.type === 'ACTIVATE') {
        const next: VoiceState = event.type === 'ACTIVATE' ? 'ACTIVATED' : 'IDLE';
        const base =
          event.type === 'ACTIVATE'
            ? {
                ...context,
                partialTranscript: '',
                finalTranscript: '',
                errorMessage: null,
              }
            : { ...context, errorMessage: null };
        return {
          state: next,
          context: logTransition(base, state, event.type, next),
        };
      }
      return snapshot;
    }

    default:
      return snapshot;
  }
}

export function voiceStateLabel(state: VoiceState): string {
  switch (state) {
    case 'IDLE':
      return 'Idle';
    case 'ACTIVATED':
      return 'Starting';
    case 'LISTENING':
      return 'Listening';
    case 'TRANSCRIBING':
      return 'Processing speech';
    case 'SENDING':
      return 'Sending request';
    case 'WAITING_RESPONSE':
      return 'Waiting for Hermes';
    case 'SPEAKING':
      return 'Speaking';
    case 'ERROR':
      return 'Error';
    default:
      return state;
  }
}
