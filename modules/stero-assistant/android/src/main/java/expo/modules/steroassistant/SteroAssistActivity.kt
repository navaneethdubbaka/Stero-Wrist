package expo.modules.steroassistant

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.widget.FrameLayout

/**
 * Assist / VOICE_COMMAND entry — same Muse-style orb as VoiceInteractionSession,
 * shown over the current app and lock screen.
 */
class SteroAssistActivity : Activity() {
  private var orb: SteroOrbView? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
      )
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

    val root = FrameLayout(this).apply {
      setBackgroundColor(0x00000000)
    }
    val orbView = SteroOrbView(this) {
      SteroOverlayBridge.requestCancelFromUi()
    }
    root.addView(
      orbView,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT,
      ),
    )
    setContentView(root)
    orb = orbView
    SteroOverlayBridge.attachAssist(this, orbView)

    try {
      SteroMicForegroundService.start(this)
    } catch (_: Exception) {
      // Non-fatal.
    }

    val dialPad = intent?.getBooleanExtra("stero_dialpad", false) == true
    // Talk and dial-pad share one Stero answered call (watch in-call UI).
    SteroCallSession.startAnsweredCall(this, ignoreForeign = true)
    AudioRouteHelper.warmWatchScoAsync(this, ignoreForeign = true)

    AssistantActivationBridge.requestActivation(if (dialPad) "dialpad" else "assist")
    SteroOverlayBridge.launchHeadlessHost(this, source = if (dialPad) "dialpad" else null)
  }

  override fun onNewIntent(intent: Intent?) {
    super.onNewIntent(intent)
    setIntent(intent)
    // Raised above Headless for ✕ — do not relaunch Headless or restart STT.
    if (intent?.getBooleanExtra("stero_raise_only", false) == true) {
      return
    }
    // Brought forward over ManageAssist — keep orb, re-arm pipeline.
    orb?.setPhase("listening")
    try {
      SteroMicForegroundService.start(this)
    } catch (_: Exception) {
      // Non-fatal.
    }
    val dialPad = intent?.getBooleanExtra("stero_dialpad", false) == true
    val force = intent?.getBooleanExtra("stero_reorder", false) == true
    AssistantActivationBridge.requestActivation(
      when {
        dialPad -> "dialpad"
        force -> "assist_reorder"
        else -> "assist"
      },
      force = force,
    )
    SteroOverlayBridge.launchHeadlessHost(this, source = if (dialPad) "dialpad" else null)
  }

  override fun onDestroy() {
    SteroOverlayBridge.clearAssist(this)
    orb = null
    super.onDestroy()
  }
}
