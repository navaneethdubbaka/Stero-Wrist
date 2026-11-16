package expo.modules.steroassistant

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.exception.Exceptions

class SteroAssistantModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val voiceInteractionComponent: String
    get() = "${context.packageName}/expo.modules.steroassistant.SteroVoiceInteractionService"

  fun emitAssistantActivate(source: String) {
    sendEvent("assistantActivate", mapOf("source" to source))
  }

  fun emitOverlayCancel() {
    sendEvent("assistantOverlayCancel", emptyMap<String, Any>())
  }

  override fun definition() = ModuleDefinition {
    Name("SteroAssistant")

    Events("assistantActivate", "assistantOverlayCancel")

    OnStartObserving {
      AssistantActivationBridge.flushPendingToJs()
    }

    OnCreate {
      AssistantActivationBridge.module = this@SteroAssistantModule
      SteroOverlayBridge.module = this@SteroAssistantModule
      Log.i("SteroAssist", "JS module live")
      val appCtx = appContext.reactContext?.applicationContext
      if (appCtx != null) {
        try {
          HeadsetVrWatcher.start(appCtx)
        } catch (_: Exception) {
          // VIS also starts the watcher.
        }
      }
    }

    OnDestroy {
      if (AssistantActivationBridge.module === this@SteroAssistantModule) {
        AssistantActivationBridge.module = null
      }
      if (SteroOverlayBridge.module === this@SteroAssistantModule) {
        SteroOverlayBridge.module = null
      }
    }

    AsyncFunction("isDefaultAssistant") {
      isDefaultAssistantInternal()
    }

    AsyncFunction("getAssistantStatus") {
      getAssistantStatusInternal()
    }

    AsyncFunction("openAssistantSettings") {
      openAssistantSettingsInternal()
    }

    AsyncFunction("applyVoiceInteractionSelection") {
      applyVoiceInteractionSelectionInternal()
    }

    AsyncFunction("startInputRoute") { preferWatch: Boolean ->
      AudioRouteHelper.startInputRoute(context, preferWatch)
    }

    AsyncFunction("stopInputRoute") {
      AudioRouteHelper.stopInputRoute(context)
    }

    AsyncFunction("getActiveInputInfo") {
      AudioRouteHelper.getActiveInputInfo(context)
    }

    AsyncFunction("preferOutputRoute") { preference: String ->
      AudioRouteHelper.preferOutputRoute(context, preference)
    }

    AsyncFunction("consumePendingActivation") {
      AssistantActivationBridge.consumePending()
    }

    AsyncFunction("startMicForegroundService") {
      SteroMicForegroundService.start(context)
    }

    AsyncFunction("stopMicForegroundService") {
      SteroMicForegroundService.stop(context)
    }

    AsyncFunction("setOverlayPhase") { phase: String ->
      SteroOverlayBridge.setPhase(phase)
    }

    AsyncFunction("dismissOverlay") {
      AudioRouteHelper.stopInputRoute(context)
      SteroOverlayBridge.dismiss()
    }

    AsyncFunction("playListenCue") {
      ListenCueHelper.playReadyBeepBlocking(context)
    }

    AsyncFunction("playTranscriptCue") {
      ListenCueHelper.playTranscriptBeepBlocking(context)
    }

    AsyncFunction("beginWatchCapture") {
      AudioRouteHelper.beginWatchCapture(context)
    }

    AsyncFunction("endWatchCapture") {
      AudioRouteHelper.endWatchCapture(context)
    }

    AsyncFunction("releaseWatchListening") {
      AudioRouteHelper.endWatchCapture(context)
    }

    AsyncFunction("consumePendingOverlayCancel") {
      AssistantActivationBridge.consumePendingCancel()
    }

    AsyncFunction("isOverlayHost") {
      val activity = appContext.currentActivity
      val name = activity?.javaClass?.name.orEmpty()
      name.contains("SteroHeadless") || SteroOverlayBridge.isHeadlessAttached()
    }

    AsyncFunction("isWatchSessionLive") {
      SteroCallSession.isActive() || SteroOverlayBridge.isUiShowing()
    }

    AsyncFunction("takeWatchRecording") {
      SteroCallMic.takeLastWav()
    }

    AsyncFunction("transcribeGroq") { path: String, apiKey: String, model: String, language: String ->
      GroqWhisperClient.transcribe(path, apiKey, model, language)
    }

    AsyncFunction("synthesizeFishAudio") { apiKey: String, model: String, jsonBody: String ->
      FishAudioTtsClient.synthesize(context, apiKey, model, jsonBody)
    }
  }

  private fun getAssistantStatusInternal(): Map<String, Any?> {
    val roleHeld = isRoleAssistantHeld()
    val voiceService = readSecure("voice_interaction_service")
    val assistComponent = readSecure("assistant")
    val ours = voiceInteractionComponent
    val voiceSelected = !voiceService.isNullOrBlank() &&
      (voiceService == ours || voiceService.startsWith(context.packageName))
    val assistSelected = !assistComponent.isNullOrBlank() &&
      assistComponent.contains(context.packageName)
    return mapOf(
      "roleHeld" to roleHeld,
      "voiceInteractionService" to (voiceService ?: ""),
      "assistComponent" to (assistComponent ?: ""),
      "ourComponent" to ours,
      "isSelected" to (roleHeld || voiceSelected || assistSelected),
      "voiceSelected" to voiceSelected,
      "assistSelected" to assistSelected,
    )
  }

  private fun isDefaultAssistantInternal(): Boolean {
    val status = getAssistantStatusInternal()
    return status["isSelected"] == true
  }

  private fun isRoleAssistantHeld(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return false
    return try {
      val rm = context.getSystemService(Context.ROLE_SERVICE) ?: return false
      val roleAssistant = "android.app.role.ASSISTANT"
      val isAvailable = rm.javaClass
        .getMethod("isRoleAvailable", String::class.java)
        .invoke(rm, roleAssistant) as Boolean
      if (!isAvailable) return false
      rm.javaClass
        .getMethod("isRoleHeld", String::class.java)
        .invoke(rm, roleAssistant) as Boolean
    } catch (_: Exception) {
      false
    }
  }

  private fun readSecure(key: String): String? {
    return try {
      Settings.Secure.getString(context.contentResolver, key)
    } catch (_: Exception) {
      null
    }
  }

  /**
   * Writes Secure settings so OEM / watch “Talk to assistant” actually targets Stero.
   * Requires WRITE_SECURE_SETTINGS (grant via adb once).
   */
  private fun applyVoiceInteractionSelectionInternal(): Map<String, Any> {
    val vis = voiceInteractionComponent
    val assist = "${context.packageName}/expo.modules.steroassistant.SteroAssistActivity"
    return try {
      val cr = context.contentResolver
      Settings.Secure.putString(cr, "voice_interaction_service", vis)
      Settings.Secure.putString(cr, "assistant", assist)
      mapOf(
        "ok" to true,
        "voiceInteractionService" to (Settings.Secure.getString(cr, "voice_interaction_service") ?: ""),
        "assistant" to (Settings.Secure.getString(cr, "assistant") ?: ""),
      )
    } catch (error: SecurityException) {
      mapOf(
        "ok" to false,
        "error" to "WRITE_SECURE_SETTINGS not granted. Run: adb shell pm grant ${context.packageName} android.permission.WRITE_SECURE_SETTINGS",
        "voiceInteractionService" to vis,
      )
    } catch (error: Exception) {
      mapOf(
        "ok" to false,
        "error" to (error.message ?: "Failed to apply selection"),
        "voiceInteractionService" to vis,
      )
    }
  }

  private fun openAssistantSettingsInternal() {
    val activity = appContext.currentActivity
    val intents = mutableListOf<Intent>()

    // 1) ROLE_ASSISTANT picker (Pixel / stock)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      try {
        val rm = context.getSystemService(Context.ROLE_SERVICE)
        if (rm != null) {
          val roleAssistant = "android.app.role.ASSISTANT"
          val isAvailable = rm.javaClass
            .getMethod("isRoleAvailable", String::class.java)
            .invoke(rm, roleAssistant) as Boolean
          if (isAvailable) {
            val intent = rm.javaClass
              .getMethod("createRequestRoleIntent", String::class.java)
              .invoke(rm, roleAssistant) as Intent
            intents.add(intent)
          }
        }
      } catch (_: Exception) {
        // continue
      }
    }

    // 2) Assist & voice input (shows Assist app — often lists Stero when Digital assistant does not)
    intents.add(Intent(Settings.ACTION_VOICE_INPUT_SETTINGS))

    // 3) OEM / generic default-apps screens
    intents.add(Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS))
    try {
      intents.add(
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
          data = android.net.Uri.parse("package:${context.packageName}")
        },
      )
    } catch (_: Exception) {
      // ignore
    }

    // 4) vivo / iQOO / Oppo style assistant settings (best-effort; may not resolve)
    for (pkgActivity in listOf(
      "com.vivo.assistant/.AssistantSettingsActivity",
      "com.vivo.agent/.ui.MainActivity",
      "com.iqoo.secure/.MainActivity",
    )) {
      try {
        val cn = ComponentName.unflattenFromString(pkgActivity) ?: continue
        intents.add(Intent().setComponent(cn))
      } catch (_: Exception) {
        // ignore
      }
    }

    intents.add(Intent(Settings.ACTION_SETTINGS))

    for (intent in intents) {
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        if (activity != null) {
          activity.startActivity(intent)
        } else {
          context.startActivity(intent)
        }
        return
      } catch (_: Exception) {
        // try next
      }
    }
  }
}
