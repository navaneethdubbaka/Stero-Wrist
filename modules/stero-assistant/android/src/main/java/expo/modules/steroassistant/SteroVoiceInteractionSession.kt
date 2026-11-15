package expo.modules.steroassistant

import android.content.Context
import android.os.Bundle
import android.service.voice.VoiceInteractionSession
import android.view.View
import android.widget.FrameLayout

/**
 * Muse-style Stero orb session. Content is created via [onCreateContentView]
 * (required for the system window to actually show — unlike ChatGPT/Muse).
 */
class SteroVoiceInteractionSession(context: Context) : VoiceInteractionSession(context) {
  private var orb: SteroOrbView? = null
  private var root: FrameLayout? = null

  override fun onCreateContentView(): View {
    val frame = FrameLayout(context).apply {
      setBackgroundColor(0x00000000)
      layoutParams = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT,
      )
    }
    val orbView = SteroOrbView(context) {
      SteroOverlayBridge.requestCancelFromUi()
    }
    frame.addView(
      orbView,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT,
      ),
    )
    root = frame
    orb = orbView
    SteroOverlayBridge.attachSession(this, orbView)
    return frame
  }

  override fun onShow(args: Bundle?, showFlags: Int) {
    super.onShow(args, showFlags)
    orb?.setPhase("listening")

    try {
      SteroMicForegroundService.start(context)
    } catch (_: Exception) {
      // FGS may fail without permission; JS path still attempts listen.
    }

    AssistantActivationBridge.requestActivation("watch")
    SteroOverlayBridge.launchHeadlessHost(context)
  }

  override fun onHide() {
    SteroOverlayBridge.clearSession(this)
    orb = null
    root = null
    super.onHide()
  }
}
