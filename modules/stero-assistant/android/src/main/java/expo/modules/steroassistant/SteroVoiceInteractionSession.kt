package expo.modules.steroassistant

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.service.voice.VoiceInteractionSession

/**
 * Shown when the system (or watch assistant button) invokes the default digital assistant.
 * Hands off immediately to the RN voice pipeline via [AssistantActivationBridge].
 */
class SteroVoiceInteractionSession(context: Context) : VoiceInteractionSession(context) {
  override fun onShow(args: Bundle?, showFlags: Int) {
    super.onShow(args, showFlags)
    try {
      SteroMicForegroundService.start(context)
    } catch (_: Exception) {
      // FGS may fail without permission; JS path still attempts listen.
    }
    AssistantActivationBridge.requestActivation("watch")
    bringAppToForeground()
    // Close the system session UI; Stero Wrist Home owns the interaction UX.
    hide()
  }

  private fun bringAppToForeground() {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: return
    launch.addFlags(
      Intent.FLAG_ACTIVITY_NEW_TASK or
        Intent.FLAG_ACTIVITY_SINGLE_TOP or
        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT,
    )
    launch.putExtra("stero_activate", true)
    launch.data = android.net.Uri.parse("stero-wrist://activate")
    try {
      context.startActivity(launch)
    } catch (_: Exception) {
      // Activation event / pending flag still covers JS when app resumes.
    }
  }
}
