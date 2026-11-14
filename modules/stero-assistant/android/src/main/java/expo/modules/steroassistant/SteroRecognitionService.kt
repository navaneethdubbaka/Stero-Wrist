package expo.modules.steroassistant

import android.content.Intent
import android.os.Bundle
import android.os.RemoteException
import android.speech.RecognitionService
import android.speech.SpeechRecognizer

/**
 * Stub [RecognitionService] required by VoiceInteractionServiceInfo.
 * Stero does STT in JS (expo-speech-recognition); this exists so the system
 * marks our VoiceInteractionService as VALID and will start sessions from
 * watch / Assist triggers instead of bouncing to Digital assistant settings.
 */
class SteroRecognitionService : RecognitionService() {
  override fun onStartListening(recognizerIntent: Intent, listener: Callback) {
    try {
      // Hand off to Stero UI; do not attempt system STT here.
      AssistantActivationBridge.requestActivation("recognition")
      listener.readyForSpeech(Bundle())
      listener.endOfSpeech()
      listener.results(Bundle().apply {
        putStringArrayList(
          SpeechRecognizer.RESULTS_RECOGNITION,
          arrayListOf(""),
        )
      })
    } catch (_: RemoteException) {
      // Client died.
    } catch (_: Exception) {
      try {
        listener.error(SpeechRecognizer.ERROR_CLIENT)
      } catch (_: RemoteException) {
        // ignore
      }
    }
  }

  override fun onCancel(listener: Callback) {
    // no-op
  }

  override fun onStopListening(listener: Callback) {
    try {
      listener.endOfSpeech()
    } catch (_: RemoteException) {
      // ignore
    }
  }
}
