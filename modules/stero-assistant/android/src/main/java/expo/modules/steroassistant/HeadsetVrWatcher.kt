package expo.modules.steroassistant

import android.app.ActivityManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothHeadset
import android.bluetooth.BluetoothProfile
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log

/**
 * Watch HFP Talk → VOICE_COMMAND is permanently preferred to Google HandsFree
 * (mAlways=true). HandsFree opens Digital assistant settings when Google is not
 * the default assistant. Power-button Assist uses VIS and works.
 *
 * Strategy: listen for HFP SCO / headset audio, and also poll usage stats for
 * HandsFree / ManageAssist appearing — then bring Stero’s orb on top.
 */
object HeadsetVrWatcher {
  private const val TAG = "SteroHeadsetVr"
  private val mainHandler = Handler(Looper.getMainLooper())

  private const val GOOGLE_HANDSFREE =
    "com.google.android.voicesearch.handsfree.HandsFreeActivity"
  private const val MANAGE_ASSIST =
    "com.android.settings.Settings\$ManageAssistActivity"
  private const val SETTINGS_PKG = "com.android.settings"
  private const val GOOGLE_PKG = "com.google.android.googlequicksearchbox"

  @Volatile
  private var registered = false

  @Volatile
  private var appContext: Context? = null

  @Volatile
  private var headset: BluetoothHeadset? = null

  @Volatile
  private var ourSco = false

  @Volatile
  private var lastTriggerAt = 0L

  /** After a successful show/raise, ignore ManageAssist spam that cancels STT. */
  @Volatile
  private var quietUntilElapsed = 0L

  private val pollRunnable = object : Runnable {
    override fun run() {
      val ctx = appContext ?: return
      if (looksLikeWatchTalkHijack(ctx)) {
        triggerAssistantUi("usage_poll")
      }
      mainHandler.postDelayed(this, 350)
    }
  }

  private val profileListener = object : BluetoothProfile.ServiceListener {
    override fun onServiceConnected(profile: Int, proxy: BluetoothProfile) {
      if (profile == BluetoothProfile.HEADSET) {
        headset = proxy as BluetoothHeadset
      }
    }

    override fun onServiceDisconnected(profile: Int) {
      if (profile == BluetoothProfile.HEADSET) {
        headset = null
      }
    }
  }

  private val receiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      when (intent.action) {
        AudioManager.ACTION_SCO_AUDIO_STATE_UPDATED,
        AudioManager.ACTION_SCO_AUDIO_STATE_CHANGED,
        -> {
          val state = intent.getIntExtra(
            AudioManager.EXTRA_SCO_AUDIO_STATE,
            AudioManager.SCO_AUDIO_STATE_DISCONNECTED,
          )
          if (state == AudioManager.SCO_AUDIO_STATE_CONNECTED && !ourSco) {
            Log.i(TAG, "External SCO connected — watch HFP VR")
            triggerAssistantUi("sco")
          }
        }
        BluetoothHeadset.ACTION_VENDOR_SPECIFIC_HEADSET_EVENT -> {
          val cmd = intent.getStringExtra(BluetoothHeadset.EXTRA_VENDOR_SPECIFIC_HEADSET_EVENT_CMD)
          Log.i(TAG, "Vendor headset event cmd=$cmd")
          if (cmd != null && (
              cmd.uppercase().contains("BVRA") ||
                cmd.uppercase().contains("VOICE")
              )
          ) {
            triggerAssistantUi("bvra")
          } else {
            // Any vendor AT from headset while Stero is VIS — arm a short poll burst.
            armBurstPoll()
          }
        }
        BluetoothHeadset.ACTION_AUDIO_STATE_CHANGED -> {
          val state = intent.getIntExtra(
            BluetoothHeadset.EXTRA_STATE,
            BluetoothHeadset.STATE_AUDIO_DISCONNECTED,
          )
          if (state == BluetoothHeadset.STATE_AUDIO_CONNECTED && !ourSco) {
            Log.i(TAG, "Headset audio connected — watch VR path")
            triggerAssistantUi("hfp_audio")
          } else if (state == BluetoothHeadset.STATE_AUDIO_CONNECTING) {
            armBurstPoll()
          }
        }
      }
    }
  }

  fun markOurSco(active: Boolean) {
    ourSco = active
  }

  /** Ignore HandsFree/ManageAssist hijack after the user dismisses ✕. */
  fun armCancelQuiet(durationMs: Long = 25_000L) {
    val now = SystemClock.elapsedRealtime()
    lastTriggerAt = now
    quietUntilElapsed = now + durationMs
    Log.i(TAG, "Cancel quiet ${durationMs}ms")
  }

  fun start(context: Context) {
    if (registered) return
    val app = context.applicationContext
    appContext = app
    try {
      val filter = IntentFilter().apply {
        addAction(AudioManager.ACTION_SCO_AUDIO_STATE_UPDATED)
        @Suppress("DEPRECATION")
        addAction(AudioManager.ACTION_SCO_AUDIO_STATE_CHANGED)
        addAction(BluetoothHeadset.ACTION_AUDIO_STATE_CHANGED)
        addAction(BluetoothHeadset.ACTION_VENDOR_SPECIFIC_HEADSET_EVENT)
      }
      val companyPrefix = "android.bluetooth.headset.intent.category.companyid."
      for (i in 0..20) {
        filter.addCategory(companyPrefix + i)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        app.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
      } else {
        @Suppress("UnspecifiedRegisterReceiverFlag")
        app.registerReceiver(receiver, filter)
      }
      registered = true
    } catch (e: Exception) {
      Log.w(TAG, "registerReceiver failed: ${e.message}")
    }

    try {
      BluetoothAdapter.getDefaultAdapter()?.getProfileProxy(
        app,
        profileListener,
        BluetoothProfile.HEADSET,
      )
    } catch (_: Exception) {
      // ignore
    }

    // Continuous light poll — catches HandsFree → ManageAssist even without SCO.
    mainHandler.removeCallbacks(pollRunnable)
    mainHandler.postDelayed(pollRunnable, 800)
  }

  fun stop(context: Context) {
    mainHandler.removeCallbacks(pollRunnable)
    if (!registered) return
    try {
      context.applicationContext.unregisterReceiver(receiver)
    } catch (_: Exception) {
      // ignore
    }
    registered = false
    val adapter = BluetoothAdapter.getDefaultAdapter()
    val proxy = headset
    if (adapter != null && proxy != null) {
      try {
        adapter.closeProfileProxy(BluetoothProfile.HEADSET, proxy)
      } catch (_: Exception) {
        // ignore
      }
    }
    headset = null
  }

  private fun armBurstPoll() {
    // Extra checks for a few seconds after headset noise.
    var n = 0
    val burst = object : Runnable {
      override fun run() {
        val ctx = appContext ?: return
        if (looksLikeWatchTalkHijack(ctx)) {
          triggerAssistantUi("burst_poll")
          return
        }
        n += 1
        if (n < 20) {
          mainHandler.postDelayed(this, 250)
        }
      }
    }
    mainHandler.post(burst)
  }

  private fun looksLikeWatchTalkHijack(context: Context): Boolean {
    // Usage stats (preferred).
    try {
      val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
      if (usm != null) {
        val end = System.currentTimeMillis()
        val begin = end - 4000
        val events = usm.queryEvents(begin, end)
        val event = UsageEvents.Event()
        while (events.hasNextEvent()) {
          events.getNextEvent(event)
          if (event.eventType != UsageEvents.Event.MOVE_TO_FOREGROUND &&
            event.eventType != UsageEvents.Event.ACTIVITY_RESUMED
          ) {
            continue
          }
          val cls = event.className ?: continue
          if (cls.contains("ManageAssist") ||
            cls.contains("HandsFreeActivity") ||
            cls.contains("VoiceAssistEntrypoint")
          ) {
            return true
          }
        }
      }
    } catch (e: Exception) {
      Log.w(TAG, "usage stats: ${e.message}")
    }

    // Fallback: deprecated getRunningTasks (often empty on modern Android).
    try {
      @Suppress("DEPRECATION")
      val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
      @Suppress("DEPRECATION")
      val tasks = am.getRunningTasks(3)
      for (task in tasks) {
        val comp = task.topActivity ?: continue
        val cls = comp.className
        if (cls.contains("ManageAssist") || cls.contains("HandsFreeActivity")) {
          return true
        }
        if (comp.packageName == SETTINGS_PKG || comp.packageName == GOOGLE_PKG) {
          // Narrow: only if component name looks assist-related
          if (cls.contains("Assist") || cls.contains("Voice") || cls.contains("HandsFree")) {
            return true
          }
        }
      }
    } catch (_: Exception) {
      // ignore
    }
    return false
  }

  private fun triggerAssistantUi(source: String) {
    val now = SystemClock.elapsedRealtime()
    // Short debounce only — ManageAssist can reappear on every Talk.
    if (now - lastTriggerAt < 1200) return
    // Quiet window: ManageAssist spam was reordering and restarting STT.
    if (now < quietUntilElapsed) {
      return
    }

    val ctx = appContext ?: return

    // Orb already up: only raise UI. Warming SCO here re-opens the watch call forever.
    if (SteroOverlayBridge.isUiShowing()) {
      SteroOverlayBridge.forceOurTasksToFront(ctx)
      if (SteroOverlayBridge.isUiInForeground()) {
        Log.i(TAG, "Skip $source — Stero UI already foreground")
        lastTriggerAt = now
        quietUntilElapsed = now + 25_000L
        return
      }
      lastTriggerAt = now
      quietUntilElapsed = now + 12_000L
      Log.i(TAG, "Reordering Stero UI from $source (was buried) — keep listen")
      SteroOverlayBridge.bringToFront(ctx, rearmMic = false)
      return
    }

    lastTriggerAt = now
    quietUntilElapsed = now + 12_000L
    AudioRouteHelper.warmWatchScoAsync(ctx)
    mainHandler.post {
      Log.i(TAG, "Showing Stero assistant UI from $source")
      // One orb only: AssistActivity (not VIS session). Calling both stacked two orbs
      // and double-activated the mic → SCO stop/start glitches.
      try {
        val intent = Intent(ctx, SteroAssistActivity::class.java).apply {
          addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK or
              Intent.FLAG_ACTIVITY_CLEAR_TOP or
              Intent.FLAG_ACTIVITY_SINGLE_TOP or
              Intent.FLAG_ACTIVITY_REORDER_TO_FRONT,
          )
        }
        ctx.startActivity(intent)
      } catch (e: Exception) {
        Log.w(TAG, "start AssistActivity failed: ${e.message}")
      }
      mainHandler.postDelayed({
        SteroOverlayBridge.forceOurTasksToFront(ctx)
        if (SteroOverlayBridge.isUiInForeground()) return@postDelayed
        SteroOverlayBridge.bringToFront(ctx, rearmMic = false)
      }, 600)
    }
  }
}
