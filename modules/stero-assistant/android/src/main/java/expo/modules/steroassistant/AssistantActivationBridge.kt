package expo.modules.steroassistant

import android.os.Handler
import android.os.Looper
import android.util.Log

/**
 * Bridges VoiceInteractionSession (may start before JS is ready) to the Expo module.
 */
object AssistantActivationBridge {
  private const val TAG = "SteroAssist"

  @Volatile
  private var pendingSource: String? = null

  @Volatile
  private var pendingCancel: Boolean = false

  @Volatile
  private var lastActivateAtMs: Long = 0L

  @Volatile
  var module: SteroAssistantModule? = null

  private val main = Handler(Looper.getMainLooper())

  fun requestActivation(source: String, force: Boolean = false) {
    val now = System.currentTimeMillis()
    // Session + Assist + deeplink can all fire; one activation keeps SCO stable.
    // force=true when reordering over ManageAssist after a buried session.
    if (!force && now - lastActivateAtMs < 2500L) {
      return
    }
    lastActivateAtMs = now
    // Keep pending until JS consumePendingActivation — emit can fire before listeners.
    pendingSource = source
    module?.emitAssistantActivate(source)
  }

  fun requestCancel() {
    pendingCancel = true
    pendingSource = null
    val jsReady = module != null
    emitCancel()
    if (jsReady) return
    // JS may not have subscribed yet (Headless still booting). Re-emit until consumed.
    main.postDelayed({ if (pendingCancel) emitCancel() }, 800)
    main.postDelayed({ if (pendingCancel) emitCancel() }, 2_000)
    main.postDelayed({ if (pendingCancel) emitCancel() }, 4_000)
  }

  fun flushPendingToJs() {
    pendingSource?.let { src ->
      module?.emitAssistantActivate(src)
    }
    if (pendingCancel) {
      emitCancel()
    }
  }

  private fun emitCancel() {
    val m = module
    if (m != null) {
      try {
        m.emitOverlayCancel()
        Log.i(TAG, "overlay cancel emitted pending=$pendingCancel")
      } catch (e: Exception) {
        Log.w(TAG, "emitOverlayCancel: ${e.message}")
      }
    } else {
      Log.i(TAG, "overlay cancel queued (no JS module)")
    }
  }

  fun consumePending(): Map<String, Any>? {
    val source = pendingSource ?: return null
    pendingSource = null
    return mapOf("source" to source)
  }

  fun consumePendingCancel(): Boolean {
    if (!pendingCancel) return false
    pendingCancel = false
    return true
  }
}
