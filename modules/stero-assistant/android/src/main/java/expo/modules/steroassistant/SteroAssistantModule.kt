package expo.modules.steroassistant

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
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

  override fun definition() = ModuleDefinition {
    Name("SteroAssistant")

    Events("assistantActivate")

    OnCreate {
      AssistantActivationBridge.module = this@SteroAssistantModule
    }

    OnDestroy {
      if (AssistantActivationBridge.module === this@SteroAssistantModule) {
        AssistantActivationBridge.module = null
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
