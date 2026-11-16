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

  private val scoTalkRunnable = Runnable {
    val ctx = appContext ?: return@Runnable
    val foreign = isForeignPhoneCall(ctx)
    val phoneUi = looksLikeRealPhoneUi(ctx)
    val appOpen = isSteroMainUiForeground(ctx)
    Log.i(
      TAG,
      "audio probe foreign=$foreign phoneUi=$phoneUi ourSco=$ourSco appOpen=$appOpen ui=${SteroOverlayBridge.isUiShowing()}",
    )
    if (SteroOverlayBridge.isUiShowing() || SteroCallSession.isActive()) return@Runnable
    SteroCallSession.answerIfRinging()
    if (foreign || phoneUi) {
      Log.i(TAG, "Ignore headset audio — real call")
      return@Runnable
    }
    // Settings / Home probe starts SCO. That is not watch Talk.
    if (ourSco || appOpen) {
      Log.i(TAG, "Skip sco_delayed — our SCO or Stero settings already open")
      return@Runnable
    }
    triggerAssistantUi("sco_delayed")
  }

  private val pollRunnable = object : Runnable {
    override fun run() {
      val ctx = appContext ?: return
      if (looksLikeWatchTalkHijack(ctx)) {
        triggerAssistantUi("usage_poll")
      }
      mainHandler.postDelayed(this, 120)
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
          if (state == AudioManager.SCO_AUDIO_STATE_CONNECTED ||
            state == AudioManager.SCO_AUDIO_STATE_CONNECTING
          ) {
            Log.i(TAG, "SCO state=$state ourSco=$ourSco")
            armBurstPoll()
            considerWatchTalkFromAudio()
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
          if (state == BluetoothHeadset.STATE_AUDIO_CONNECTED ||
            state == BluetoothHeadset.STATE_AUDIO_CONNECTING
          ) {
            Log.i(TAG, "Headset audio state=$state ourSco=$ourSco")
            armBurstPoll()
            considerWatchTalkFromAudio()
          }
        }
      }
    }
  }

  fun markOurSco(active: Boolean) {
    ourSco = active
  }

  /** Brief ignore so ManageAssist from the same hangup does not retrigger. */
  fun armCancelQuiet(durationMs: Long = 1_200L) {
    val now = SystemClock.elapsedRealtime()
    lastTriggerAt = now
    quietUntilElapsed = now + durationMs
    Log.i(TAG, "Cancel quiet ${durationMs}ms")
  }

  fun clearQuiet() {
    quietUntilElapsed = 0L
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
      for (i in 0..200) {
        filter.addCategory(companyPrefix + i)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        app.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
      } else {
        @Suppress("UnspecifiedRegisterReceiverFlag")
        app.registerReceiver(receiver, filter)
      }
      registered = true
      Log.i(TAG, "HeadsetVrWatcher started")
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
            cls.contains("VoiceAssistEntrypoint") ||
            cls.contains("voicesearch.intent") ||
            cls.contains("VoiceSearch") ||
            cls.contains("HandsFree")
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

  private fun considerWatchTalkFromAudio() {
    mainHandler.removeCallbacks(scoTalkRunnable)
    mainHandler.postDelayed(scoTalkRunnable, 600)
  }

  private fun looksLikeRealPhoneUi(context: Context): Boolean {
    try {
      val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
      if (usm != null) {
        val end = System.currentTimeMillis()
        val events = usm.queryEvents(end - 2500, end)
        val event = UsageEvents.Event()
        while (events.hasNextEvent()) {
          events.getNextEvent(event)
          if (event.eventType != UsageEvents.Event.MOVE_TO_FOREGROUND &&
            event.eventType != UsageEvents.Event.ACTIVITY_RESUMED
          ) {
            continue
          }
          val pkg = event.packageName ?: continue
          val cls = event.className ?: ""
          if (pkg.contains("sterowrist")) continue
          if (cls.contains("HandsFree") || cls.contains("ManageAssist") ||
            cls.contains("VoiceSearch") || cls.contains("VoiceAssist")
          ) {
            continue
          }
          if (pkg.contains("dialer") || pkg.contains("incallui") ||
            pkg.contains("com.android.phone") ||
            cls.contains("InCall") || cls.contains("Dialtacts")
          ) {
            return true
          }
        }
      }
    } catch (_: Exception) {
      // ignore
    }
    return false
  }

  /** MainActivity / settings — not Assist overlay. */
  private fun isSteroMainUiForeground(context: Context): Boolean {
    try {
      val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
        ?: return false
      val end = System.currentTimeMillis()
      val events = usm.queryEvents(end - 3000, end)
      val event = UsageEvents.Event()
      var lastPkg = ""
      var lastCls = ""
      while (events.hasNextEvent()) {
        events.getNextEvent(event)
        if (event.eventType != UsageEvents.Event.MOVE_TO_FOREGROUND &&
          event.eventType != UsageEvents.Event.ACTIVITY_RESUMED
        ) {
          continue
        }
        lastPkg = event.packageName ?: continue
        lastCls = event.className ?: ""
      }
      if (!lastPkg.contains("sterowrist")) return false
      return !lastCls.contains("SteroAssist") &&
        !lastCls.contains("SteroHeadless") &&
        !lastCls.contains("VoiceInteraction")
    } catch (_: Exception) {
      return false
    }
  }

  /** Cellular / default-dialer call — not our self-managed Stero session. */
  fun isForeignPhoneCall(context: Context): Boolean {
    if (SteroCallSession.isOwned()) return false
    val am = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
    val mode = am?.mode ?: AudioManager.MODE_NORMAL
    if (mode == AudioManager.MODE_IN_CALL || mode == AudioManager.MODE_RINGTONE) {
      return true
    }
    try {
      val tm = context.getSystemService(Context.TELECOM_SERVICE) as? android.telecom.TelecomManager
      if (tm != null && tm.isInCall) return true
    } catch (_: Exception) {
      // Missing READ_PHONE_STATE — mode check above is enough.
    }
    return false
  }

  private fun triggerAssistantUi(source: String) {
    val now = SystemClock.elapsedRealtime()
    if (now - lastTriggerAt < 800) return
    if (now < quietUntilElapsed) {
      Log.i(TAG, "Quiet skip $source")
      return
    }

    val ctx = appContext ?: return
    if (isForeignPhoneCall(ctx)) {
      Log.i(TAG, "Skip $source — real phone call in progress")
      return
    }
    if (SteroOverlayBridge.hangupPipelineActive) {
      Log.i(TAG, "Skip $source — hangup STT/Hermes still running")
      return
    }

    // Orb already up: raise it. Do not start a second call.
    if (SteroOverlayBridge.isUiShowing()) {
      SteroOverlayBridge.forceOurTasksToFront(ctx)
      if (SteroOverlayBridge.isUiInForeground()) {
        Log.i(TAG, "Skip $source — Stero UI already foreground")
        lastTriggerAt = now
        return
      }
      lastTriggerAt = now
      Log.i(TAG, "Reordering Stero UI from $source (was buried)")
      SteroOverlayBridge.bringToFront(ctx, rearmMic = true)
      return
    }

    lastTriggerAt = now
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
