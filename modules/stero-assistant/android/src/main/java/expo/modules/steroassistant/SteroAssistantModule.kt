package expo.modules.steroassistant

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

  private fun isDefaultAssistantInternal(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      return false
    }
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

  private fun openAssistantSettingsInternal() {
    val activity = appContext.currentActivity
    val intents = mutableListOf<Intent>()

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
        // Fall through to generic settings intents.
      }
    }

    intents.add(Intent(Settings.ACTION_VOICE_INPUT_SETTINGS))
    intents.add(Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS))
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
