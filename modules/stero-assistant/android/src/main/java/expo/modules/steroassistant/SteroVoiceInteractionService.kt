package expo.modules.steroassistant

import android.content.Intent
import android.os.Bundle
import android.service.voice.VoiceInteractionService

class SteroVoiceInteractionService : VoiceInteractionService() {
  override fun onReady() {
    super.onReady()
    instance = this
    // Watch HFP Talk bypasses VIS and hits Google HandsFree — intercept SCO/BVRA here.
    HeadsetVrWatcher.start(this)
  }

  override fun onShutdown() {
    HeadsetVrWatcher.stop(this)
    if (instance === this) {
      instance = null
    }
    super.onShutdown()
  }

  /**
   * Lock-screen / keyguard assist affordance — show the Muse-style session.
   */
  override fun onLaunchVoiceAssistFromKeyguard() {
    showAssistantSession()
  }

  fun showAssistantSession() {
    try {
      showSession(Bundle(), 0)
    } catch (_: Exception) {
      // Not ready yet — fall back to Assist activity overlay.
      try {
        val intent = Intent(this, SteroAssistActivity::class.java).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        startActivity(intent)
      } catch (_: Exception) {
        // ignore
      }
    }
  }

  companion object {
    @Volatile
    var instance: SteroVoiceInteractionService? = null

    fun requestShowSession() {
      instance?.showAssistantSession()
    }
  }
}
