package expo.modules.steroassistant

/**
 * Bridges VoiceInteractionSession (may start before JS is ready) to the Expo module.
 */
object AssistantActivationBridge {
  @Volatile
  private var pendingSource: String? = null

  @Volatile
  private var pendingCancel: Boolean = false

  @Volatile
  private var lastActivateAtMs: Long = 0L

  @Volatile
  var module: SteroAssistantModule? = null

  fun requestActivation(source: String, force: Boolean = false) {
    val now = System.currentTimeMillis()
    // Session + Assist + deeplink can all fire; one activation keeps SCO stable.
    // force=true when reordering over ManageAssist after a buried session.
    if (!force && now - lastActivateAtMs < 2500L) {
      return
    }
    lastActivateAtMs = now
    pendingSource = source
    val m = module
    if (m != null) {
      m.emitAssistantActivate(source)
      pendingSource = null
    }
  }

  fun requestCancel() {
    pendingCancel = true
    val m = module
    if (m != null) {
      m.emitOverlayCancel()
      pendingCancel = false
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
