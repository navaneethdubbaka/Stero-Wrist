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
    failedSend: false,
    sessionId: '',
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
        {
          ...context,
          partialTranscript: '',
          finalTranscript: '',
          errorMessage: null,
          failedSend: false,
          lastReply: '',
          sessionId: event.sessionId ?? context.sessionId,
        },
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
  if (state === 'SENDING' && event.type === 'REQUEST_SENT') {
    return {
      state: 'WAITING_RESPONSE',
      context: logTransition(context, state, event.type, 'WAITING_RESPONSE'),
    };
  }
  if (state === 'WAITING_RESPONSE' && event.type === 'RESPONSE_RECEIVED') {
    return {
      state: 'SPEAKING',
      context: logTransition(
        {
          ...context,
          lastReply: event.reply,
          sessionId: event.sessionId ?? context.sessionId,
        },
        state,
        event.type,
        'SPEAKING',
      ),
    };
  }
  if (state === 'SPEAKING' && event.type === 'SPEAK_DONE') {
    return {
      state: 'IDLE',
      context: logTransition(context, state, event.type, 'IDLE'),
    };
  }
  if (state === 'SENDING' && event.type === 'FAIL') {
    return {
      state: 'ERROR',
      context: logTransition(
        { ...context, errorMessage: event.message, failedSend: true },
        state,
        event.type,
        'ERROR',
      ),
    };
  }
  if (state === 'ERROR' && event.type === 'RETRY_SEND' && context.finalTranscript) {
    return {
      state: 'SENDING',
      context: logTransition(
        { ...context, errorMessage: null, failedSend: false },
        state,
        event.type,
        'SENDING',
      ),
    };
  }
  if (state === 'LISTENING' && event.type === 'FAIL') {
    return {
      state: 'ERROR',
      context: logTransition(
        { ...context, errorMessage: event.message, failedSend: !!event.failedSend },
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
        { ...context, errorMessage: null, failedSend: false },
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
  { type: 'ACTIVATE', sessionId: 'session-abc' },
  { type: 'STT_STARTED' },
  { type: 'SPEECH_ENDED' },
  { type: 'TRANSCRIPT_FINAL', transcript: 'Hello Hermes' },
  { type: 'REQUEST_SENT' },
  { type: 'RESPONSE_RECEIVED', reply: 'Hi there', sessionId: 'session-abc' },
  { type: 'SPEAK_DONE' },
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

const failRetry = run([
  { type: 'ACTIVATE' },
  { type: 'STT_STARTED' },
  { type: 'SPEECH_ENDED' },
  { type: 'TRANSCRIPT_FINAL', transcript: 'Status please' },
  { type: 'FAIL', message: 'timeout', failedSend: true },
  { type: 'RETRY_SEND' },
  { type: 'REQUEST_SENT' },
  { type: 'RESPONSE_RECEIVED', reply: 'OK' },
  { type: 'SPEAK_DONE' },
]);

let failed = 0;
function assert(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`);
  if (!cond) failed += 1;
}

assert('happy ends IDLE', happy.state === 'IDLE');
assert('happy transcript', happy.context.finalTranscript === 'Hello Hermes');
assert('happy reply', happy.context.lastReply === 'Hi there');
assert('happy session', happy.context.sessionId === 'session-abc');
assert('happy logged', happy.context.transitionLog.length >= 6);
assert('cancel IDLE', cancel.state === 'IDLE');
assert('empty IDLE with message', empty.state === 'IDLE' && !!empty.context.errorMessage);
assert('retry ends IDLE', failRetry.state === 'IDLE');
assert('retry reply', failRetry.context.lastReply === 'OK');

if (failed) process.exit(1);
console.log('All voice machine checks passed.');
