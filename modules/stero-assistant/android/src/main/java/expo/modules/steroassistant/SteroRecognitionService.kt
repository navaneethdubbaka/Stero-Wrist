package expo.modules.steroassistant

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.RemoteException
import android.speech.RecognitionService
import android.speech.SpeechRecognizer
import java.util.concurrent.atomic.AtomicReference

/**
 * RecognitionService required by VoiceInteractionServiceInfo.
 *
 * Watch HFP “Talk to assistant” (AT+BVRA) often routes through this service.
 * Returning empty results immediately makes the system think recognition failed
 * and drops the user on Digital assistant settings — so we keep the callback
 * open, show the Stero session/orb, and only finish when cancelled/stopped.
 */
class SteroRecognitionService : RecognitionService() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val activeListener = AtomicReference<Callback?>(null)

  override fun onStartListening(recognizerIntent: Intent, listener: Callback) {
    activeListener.set(listener)
    try {
      listener.readyForSpeech(Bundle())
    } catch (_: RemoteException) {
      return
    }

    // Show Muse-style VIS session (preferred) or Assist overlay.
    mainHandler.post {
      SteroVoiceInteractionService.requestShowSession()
      try {
        SteroMicForegroundService.start(this)
      } catch (_: Exception) {
        // ignore
      }
      AssistantActivationBridge.requestActivation("recognition")
      SteroOverlayBridge.launchHeadlessHost(this)
      SteroOverlayBridge.setPhase("listening")
    }

    // Soft “listening” cue — do NOT endOfSpeech / results here.
    try {
      listener.beginningOfSpeech()
    } catch (_: RemoteException) {
      // ignore
    }
  }

  override fun onCancel(listener: Callback) {
    finishListener(listener, cancelled = true)
  }

  override fun onStopListening(listener: Callback) {
    // Headset released VR — keep Stero session/orb running for STT in JS.
    // Just acknowledge stop without error results.
    try {
      listener.endOfSpeech()
    } catch (_: RemoteException) {
      // ignore
    }
  }

  private fun finishListener(listener: Callback, cancelled: Boolean) {
    if (activeListener.get() !== listener) return
    activeListener.set(null)
    try {
      if (cancelled) {
        listener.error(SpeechRecognizer.ERROR_CLIENT)
      } else {
        listener.endOfSpeech()
        listener.results(
          Bundle().apply {
            putStringArrayList(
              SpeechRecognizer.RESULTS_RECOGNITION,
              arrayListOf(""),
            )
          },
        )
      }
    } catch (_: RemoteException) {
      // ignore
    }
  }
}
