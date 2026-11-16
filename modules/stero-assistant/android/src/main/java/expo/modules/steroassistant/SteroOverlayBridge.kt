package expo.modules.steroassistant

import android.app.Activity
import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import java.lang.ref.WeakReference

/**
 * Coordinates Muse-style orb UI (session or assist activity) with JS pipeline phases.
 */
object SteroOverlayBridge {
  private const val TAG = "SteroAssist"
  private val mainHandler = Handler(Looper.getMainLooper())

  @Volatile
  private var sessionRef: WeakReference<SteroVoiceInteractionSession>? = null

  @Volatile
  private var assistRef: WeakReference<Activity>? = null

  @Volatile
  private var headlessRef: WeakReference<Activity>? = null

  @Volatile
  private var orbRef: WeakReference<SteroOrbView>? = null

  @Volatile
  var module: SteroAssistantModule? = null

  /** True after watch hang-up while JS still transcribes / waits on Hermes. */
  @Volatile
  var hangupPipelineActive: Boolean = false
    private set

  fun attachSession(session: SteroVoiceInteractionSession, orb: SteroOrbView) {
    sessionRef = WeakReference(session)
    orbRef = WeakReference(orb)
  }

  fun attachAssist(activity: Activity, orb: SteroOrbView) {
    assistRef = WeakReference(activity)
    orbRef = WeakReference(orb)
  }

  fun attachHeadless(activity: Activity) {
    headlessRef = WeakReference(activity)
  }

  fun isHeadlessAttached(): Boolean {
    pruneDeadRefs()
    val headless = headlessRef?.get() ?: return false
    return !headless.isFinishing && !headless.isDestroyed
  }

  fun clearSession(session: SteroVoiceInteractionSession) {
    if (sessionRef?.get() === session) {
      sessionRef = null
      if (assistRef?.get() == null) orbRef = null
    }
  }

  fun clearAssist(activity: Activity) {
    if (assistRef?.get() === activity) {
      assistRef = null
      if (sessionRef?.get() == null) orbRef = null
    }
  }

  fun clearHeadless(activity: Activity) {
    if (headlessRef?.get() === activity) {
      headlessRef = null
    }
  }

  fun setPhase(phase: String) {
    mainHandler.post {
      orbRef?.get()?.setPhase(phase)
    }
  }

  /** True if session orb and/or AssistActivity orb is still attached (may be under Settings). */
  fun isUiShowing(): Boolean {
    pruneDeadRefs()
    return sessionRef?.get() != null || assistRef?.get() != null
  }

  /** True if Stero orb window currently has focus (not buried under ManageAssist). */
  fun isUiInForeground(): Boolean {
    pruneDeadRefs()
    val assist = assistRef?.get()
    if (assist != null && !assist.isFinishing && assist.hasWindowFocus()) return true
    return false
  }

  /**
   * Bring existing Assist + headless host above HandsFree/ManageAssist.
   * Assist (orb + ✕) is always started last so it stays above the JS host.
   * @param rearmMic when true, force a new listen cycle (only if prior session died).
   */
  fun bringToFront(context: Context, rearmMic: Boolean = false) {
    val appCtx = context.applicationContext
    mainHandler.post {
      forceOurTasksToFront(appCtx)
      val headless = headlessRef?.get()
      val headlessDead =
        headless == null || headless.isFinishing || headless.isDestroyed
      if (rearmMic || headlessDead) {
        launchHeadlessHost(appCtx)
      }
      if (rearmMic) {
        AssistantActivationBridge.requestActivation("assist_reorder", force = true)
      }
      raiseAssistAboveHeadless(appCtx, rearmMic = false)
      mainHandler.postDelayed({ forceOurTasksToFront(appCtx) }, 250)
      mainHandler.postDelayed({
        forceOurTasksToFront(appCtx)
        raiseAssistAboveHeadless(appCtx, rearmMic = false)
      }, 700)
      mainHandler.postDelayed({ forceOurTasksToFront(appCtx) }, 1400)
    }
  }

  /** Raise the orb task only — never Headless (that paints a grey empty window). */
  fun forceOurTasksToFront(context: Context) {
    try {
      val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
      for (task in am.appTasks) {
        val info = try {
          task.taskInfo
        } catch (_: Exception) {
          null
        }
        if (info == null) continue
        val cls =
          info.topActivity?.className
            ?: info.baseActivity?.className
            ?: continue
        if (cls.contains("SteroAssist")) {
          try {
            task.moveToFront()
            Log.i(TAG, "moveToFront $cls")
          } catch (e: Exception) {
            Log.w(TAG, "moveToFront failed: ${e.message}")
          }
        }
      }
    } catch (e: Exception) {
      Log.w(TAG, "appTasks: ${e.message}")
    }
  }

  /** Move Assist task to front so ✕ receives taps (Headless is a separate affinity). */
  fun raiseAssistAboveHeadless(context: Context, rearmMic: Boolean = false) {
    val appCtx = context.applicationContext
    mainHandler.post {
      try {
        val intent = Intent(appCtx, SteroAssistActivity::class.java).apply {
          addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK or
              Intent.FLAG_ACTIVITY_CLEAR_TOP or
              Intent.FLAG_ACTIVITY_SINGLE_TOP or
              Intent.FLAG_ACTIVITY_REORDER_TO_FRONT,
          )
          putExtra("stero_raise_only", !rearmMic)
          putExtra("stero_reorder", rearmMic)
        }
        appCtx.startActivity(intent)
      } catch (_: Exception) {
        // ignore
      }
    }
  }

  private fun pruneDeadRefs() {
    val assist = assistRef?.get()
    if (assist != null && (assist.isFinishing || assist.isDestroyed)) {
      assistRef = null
      if (sessionRef?.get() == null) orbRef = null
    }
    val headless = headlessRef?.get()
    if (headless != null && (headless.isFinishing || headless.isDestroyed)) {
      headlessRef = null
    }
  }

  fun dismiss() {
    hangupPipelineActive = false
    hangupWatchCall()
    mainHandler.post {
      finishAssistUiLocked()
      try {
        headlessRef?.get()?.finish()
      } catch (_: Exception) {
        // ignore
      }
    }
  }

  fun requestCancelFromUi() {
    HeadsetVrWatcher.armCancelQuiet()
    hangupWatchCall()
    AssistantActivationBridge.requestCancel()
    if (hangupPipelineActive) {
      // Second ✕: hide orb, park Headless so opening the app is not a grey sheet.
      mainHandler.post {
        finishAssistUiLocked()
        try {
          headlessRef?.get()?.moveTaskToBack(true)
        } catch (_: Exception) {
          // ignore
        }
      }
      return
    }
    hangupPipelineActive = true
    // Keep Assist + Headless up while JS transcribes the WAV and hits Hermes.
  }

  private fun finishAssistUiLocked() {
    try {
      sessionRef?.get()?.hide()
    } catch (_: Exception) {
      // ignore
    }
    try {
      assistRef?.get()?.finish()
    } catch (_: Exception) {
      // ignore
    }
  }

  private fun hangupWatchCall() {
    val ctx =
      assistRef?.get()?.applicationContext
        ?: headlessRef?.get()?.applicationContext
        ?: return
    try {
      AudioRouteHelper.endWatchCapture(ctx)
    } catch (_: Exception) {
      // ignore
    }
  }

  fun launchDialPadSession(context: Context) {
    val appCtx = context.applicationContext
    mainHandler.post {
      launchHeadlessHost(appCtx, source = "dialpad")
      try {
        val intent = Intent(appCtx, SteroAssistActivity::class.java).apply {
          addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK or
              Intent.FLAG_ACTIVITY_CLEAR_TOP or
              Intent.FLAG_ACTIVITY_SINGLE_TOP or
              Intent.FLAG_ACTIVITY_REORDER_TO_FRONT,
          )
          putExtra("stero_dialpad", true)
        }
        appCtx.startActivity(intent)
      } catch (e: Exception) {
        Log.w(TAG, "launchDialPadSession: ${e.message}")
      }
    }
  }

  fun launchHeadlessHost(context: Context, source: String? = null) {
    val appCtx = context.applicationContext
    val activateUri = if (source == "dialpad") {
      "stero-wrist://activate?overlay=1&source=dialpad"
    } else {
      "stero-wrist://activate?overlay=1"
    }
    mainHandler.post {
      val intent = Intent().setClassName(
        appCtx.packageName,
        "com.sterowrist.app.SteroHeadlessActivity",
      )
      intent.addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_SINGLE_TOP or
          Intent.FLAG_ACTIVITY_REORDER_TO_FRONT,
      )
      intent.data = Uri.parse(activateUri)
      intent.putExtra("stero_overlay", true)
      intent.putExtra("stero_activate", true)
      if (source == "dialpad") {
        intent.putExtra("stero_dialpad", true)
      }
      try {
        appCtx.startActivity(intent)
      } catch (_: Exception) {
        // Fallback: MainActivity with overlay flag (older builds).
        val launch = appCtx.packageManager.getLaunchIntentForPackage(appCtx.packageName)
          ?: return@post
        launch.addFlags(
          Intent.FLAG_ACTIVITY_NEW_TASK or
            Intent.FLAG_ACTIVITY_SINGLE_TOP or
            Intent.FLAG_ACTIVITY_REORDER_TO_FRONT,
        )
        launch.data = Uri.parse(activateUri)
        launch.putExtra("stero_overlay", true)
        launch.putExtra("stero_activate", true)
        if (source == "dialpad") {
          launch.putExtra("stero_dialpad", true)
        }
        try {
          appCtx.startActivity(launch)
        } catch (_: Exception) {
          // JS pending activation still covers cold start.
        }
      }
      // Headless is a separate task; Assist must be raised after it so ✕ is on top.
      mainHandler.postDelayed({
        raiseAssistAboveHeadless(appCtx, rearmMic = false)
      }, 180)
    }
  }
}
