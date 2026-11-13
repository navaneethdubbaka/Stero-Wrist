package expo.modules.steroassistant

import android.app.Activity
import android.content.Intent
import android.os.Bundle

/**
 * Handles ASSIST / VOICE_COMMAND so Stero appears in "Assist app" pickers
 * (often more reliable than ROLE_ASSISTANT on OEM skins).
 */
class SteroAssistActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    try {
      SteroMicForegroundService.start(this)
    } catch (_: Exception) {
      // Non-fatal.
    }
    AssistantActivationBridge.requestActivation("assist")

    val launch = packageManager.getLaunchIntentForPackage(packageName)
    if (launch != null) {
      launch.addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_SINGLE_TOP or
          Intent.FLAG_ACTIVITY_CLEAR_TOP or
          Intent.FLAG_ACTIVITY_REORDER_TO_FRONT,
      )
      launch.data = android.net.Uri.parse("stero-wrist://activate")
      launch.putExtra("stero_activate", true)
      try {
        startActivity(launch)
      } catch (_: Exception) {
        // Pending activation still covers JS resume.
      }
    }
    finish()
  }
}
