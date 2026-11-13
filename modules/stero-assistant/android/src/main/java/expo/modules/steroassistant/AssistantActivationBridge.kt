package expo.modules.steroassistant

/**
 * Bridges VoiceInteractionSession (may start before JS is ready) to the Expo module.
 */
object AssistantActivationBridge {
  @Volatile
  private var pendingSource: String? = null

  @Volatile
  var module: SteroAssistantModule? = null

  fun requestActivation(source: String) {
    pendingSource = source
    val m = module
    if (m != null) {
      m.emitAssistantActivate(source)
      pendingSource = null
    }
  }

  fun consumePending(): Map<String, Any>? {
    val source = pendingSource ?: return null
    pendingSource = null
    return mapOf("source" to source)
  }
}
