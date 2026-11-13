/**
 * Smoke tests for the voice state machine (mirrors voiceStateMachine.ts).
 * Run: node scripts/verify-voice-machine.mjs
 */

function createInitialContext() {
  return {
    partialTranscript: '',
    finalTranscript: '',
    lastReply: '',
    errorMessage: null,
    transitionLog: [],
  };
}

function createInitialSnapshot() {
  return { state: 'IDLE', context: createInitialContext() };
}

function logTransition(context, from, event, to) {
  return {
    ...context,
    transitionLog: [...context.transitionLog, `${from} --${event}--> ${to}`],
  };
}

function reduceVoice(snapshot, event) {
  const { state, context } = snapshot;

  if (state === 'IDLE' && event.type === 'ACTIVATE') {
    return {
      state: 'ACTIVATED',
      context: logTransition(
        { ...context, partialTranscript: '', finalTranscript: '', errorMessage: null },
        state,
        event.type,
        'ACTIVATED',
      ),
    };
  }
  if (state === 'ACTIVATED' && event.type === 'STT_STARTED') {
    return {
      state: 'LISTENING',
      context: logTransition(context, state, event.type, 'LISTENING'),
    };
  }
  if (state === 'LISTENING' && event.type === 'CANCEL') {
    return {
      state: 'IDLE',
      context: logTransition(
        { ...context, partialTranscript: '', errorMessage: null },
        state,
        event.type,
        'IDLE',
      ),
    };
  }
  if (state === 'LISTENING' && event.type === 'SPEECH_ENDED') {
    return {
      state: 'TRANSCRIBING',
      context: logTransition(context, state, event.type, 'TRANSCRIBING'),
    };
  }
  if (state === 'TRANSCRIBING' && event.type === 'TRANSCRIPT_FINAL') {
    const trimmed = event.transcript.trim();
    if (!trimmed) {
      return {
        state: 'IDLE',
        context: logTransition(
          {
            ...context,
            partialTranscript: '',
            finalTranscript: '',
            errorMessage: 'No speech detected.',
          },
          state,
          'TRANSCRIPT_EMPTY',
          'IDLE',
        ),
      };
    }
    return {
      state: 'SENDING',
      context: logTransition(
        {
          ...context,
          partialTranscript: trimmed,
          finalTranscript: trimmed,
          errorMessage: null,
        },
        state,
        event.type,
        'SENDING',
      ),
    };
  }
  if (state === 'SENDING' && event.type === 'MOCK_SENT') {
    return {
      state: 'WAITING_RESPONSE',
      context: logTransition(context, state, event.type, 'WAITING_RESPONSE'),
    };
  }
  if (state === 'WAITING_RESPONSE' && event.type === 'MOCK_REPLY') {
    return {
      state: 'SPEAKING',
      context: logTransition(
        { ...context, lastReply: event.reply },
        state,
        event.type,
        'SPEAKING',
      ),
    };
  }
  if (state === 'SPEAKING' && event.type === 'MOCK_SPEAK_DONE') {
    return {
      state: 'IDLE',
      context: logTransition(context, state, event.type, 'IDLE'),
    };
  }
  if (state === 'LISTENING' && event.type === 'FAIL') {
    return {
      state: 'ERROR',
      context: logTransition(
        { ...context, errorMessage: event.message },
        state,
        event.type,
        'ERROR',
      ),
    };
  }
  if (state === 'ERROR' && event.type === 'DISMISS_ERROR') {
    return {
      state: 'IDLE',
      context: logTransition(
        { ...context, errorMessage: null },
        state,
        event.type,
        'IDLE',
      ),
    };
  }
  return snapshot;
}

function run(events) {
  let snap = createInitialSnapshot();
  for (const e of events) snap = reduceVoice(snap, e);
  return snap;
}

const happy = run([
  { type: 'ACTIVATE' },
  { type: 'STT_STARTED' },
  { type: 'SPEECH_ENDED' },
  { type: 'TRANSCRIPT_FINAL', transcript: 'Hello Hermes' },
  { type: 'MOCK_SENT' },
  { type: 'MOCK_REPLY', reply: 'Hi there' },
  { type: 'MOCK_SPEAK_DONE' },
]);

const cancel = run([
  { type: 'ACTIVATE' },
  { type: 'STT_STARTED' },
  { type: 'CANCEL' },
]);

const empty = run([
  { type: 'ACTIVATE' },
  { type: 'STT_STARTED' },
  { type: 'SPEECH_ENDED' },
  { type: 'TRANSCRIPT_FINAL', transcript: '   ' },
]);

const fail = run([
  { type: 'ACTIVATE' },
  { type: 'STT_STARTED' },
  { type: 'FAIL', message: 'mic denied' },
  { type: 'DISMISS_ERROR' },
]);

let failed = 0;
function assert(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`);
  if (!cond) failed += 1;
}

assert('happy ends IDLE', happy.state === 'IDLE');
assert('happy transcript', happy.context.finalTranscript === 'Hello Hermes');
assert('happy reply', happy.context.lastReply === 'Hi there');
assert('happy logged', happy.context.transitionLog.length >= 6);
assert('cancel IDLE', cancel.state === 'IDLE');
assert('empty IDLE with message', empty.state === 'IDLE' && !!empty.context.errorMessage);
assert('fail then dismiss IDLE', fail.state === 'IDLE');

if (failed) process.exit(1);
console.log('All voice machine checks passed.');
