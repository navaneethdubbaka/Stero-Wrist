package expo.modules.steroassistant

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothHeadset
import android.bluetooth.BluetoothProfile
import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.util.Log
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

object AudioRouteHelper {
  @Volatile
  private var warming = false

  /**
   * Kick Telecom call + wait for HFP SCO (before JS boots).
   * Safe to call repeatedly; no-ops if already warming or SCO is up.
   */
  fun warmWatchScoAsync(context: Context) {
    if (warming) return
    val app = context.applicationContext
    val am = audioManager(app)
    if (am.isBluetoothScoOn && SteroCallSession.isActive()) {
      HeadsetVrWatcher.markOurSco(true)
      return
    }
    warming = true
    Thread({
      try {
        SteroCallSession.startAnsweredCall(app)
        if (!SteroCallSession.awaitActive(4000)) {
          SteroCallSession.placeOutgoingFallback(app)
          SteroCallSession.awaitActive(3000)
        }
        startScoRoute(app, am)
      } finally {
        warming = false
      }
    }, "stero-warm-sco").start()
  }

  fun getActiveInputInfo(context: Context): Map<String, Any> {
    val am = audioManager(context)
    val scoOn = am.isBluetoothScoOn
    val scoDevice = findScoInput(am)
    val headset = probeHeadset(context)

    return when {
      scoOn -> mapOf(
        "label" to (scoDevice?.let { deviceLabel(it, null) }
          ?: headset.name
          ?: "Watch HFP"),
        "kind" to "watch_hfp",
        "scoOn" to true,
        "hfpAvailable" to true,
      )
      headset.connected || scoDevice != null -> mapOf(
        "label" to "Phone mic (${headset.name ?: "HFP"} available)",
        "kind" to "phone",
        "scoOn" to false,
        "hfpAvailable" to true,
      )
      else -> mapOf(
        "label" to "Phone mic",
        "kind" to "phone",
        "scoOn" to false,
        "hfpAvailable" to false,
      )
    }
  }

  fun startInputRoute(context: Context, preferWatch: Boolean): Map<String, Any> {
    val am = audioManager(context)
    if (!preferWatch) {
      stopInputRoute(context)
      return getActiveInputInfo(context)
    }
    return startScoRoute(context, am) ?: getActiveInputInfo(context)
  }

  fun stopInputRoute(context: Context) {
    val am = audioManager(context)
    try {
      // Disconnect Telecom first so the watch drops native in-call UI.
      SteroCallSession.endAnsweredCall()
      // Leftover AT+BVRA from watch Talk (not used for our fake call).
      withHeadset(context) { _, headset ->
        for (device in headset.connectedDevices) {
          try {
            headset.stopVoiceRecognition(device)
          } catch (_: Exception) {
            // ignore
          }
        }
      }
      try {
        am.isBluetoothScoOn = false
        am.stopBluetoothSco()
      } catch (_: Exception) {
        // ignore
      }
      HeadsetVrWatcher.markOurSco(false)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        am.clearCommunicationDevice()
      }
      am.mode = AudioManager.MODE_NORMAL
      Log.i(
        "SteroAudioRoute",
        "hangup scoOn=${am.isBluetoothScoOn} audio=${isHeadsetAudioConnected(context)}",
      )
    } catch (_: Exception) {
      HeadsetVrWatcher.markOurSco(false)
    }
  }

  /**
   * Hold Telecom-answered HFP SCO for the whole listen window (no BVRA).
   */
  fun beginWatchCapture(context: Context): Map<String, Any> {
    SteroCallSession.startAnsweredCall(context)
    if (!SteroCallSession.awaitActive(4500)) {
      SteroCallSession.placeOutgoingFallback(context)
      SteroCallSession.awaitActive(3000)
    }
    val result = startInputRoute(context, preferWatch = true)
    // Android 13+: SpeechRecognizer persist needs the AudioRecord. Below 13,
    // keep our recorder so the mic indicator stays on.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      SteroCallMic.stop()
    }
    val am = audioManager(context)
    val comm = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      am.communicationDevice?.let { deviceLabel(it, it.type.toString()) } ?: "none"
    } else {
      "pre-S"
    }
    Log.i(
      "SteroAudioRoute",
      "beginWatchCapture scoOn=${am.isBluetoothScoOn} comm=$comm result=$result",
    )
    return result
  }

  fun endWatchCapture(context: Context) {
    Log.i("SteroAudioRoute", "endWatchCapture")
    stopInputRoute(context)
  }

  /** @deprecated Use endWatchCapture — kept so older JS bundles still link. */
  fun releaseWatchListening(context: Context) {
    endWatchCapture(context)
  }

  /**
   * Prefer playback output.
   * watch_speaker: keep/start HFP SCO so watch mic+speaker stay on the call path.
   */
  fun preferOutputRoute(context: Context, preference: String): Map<String, Any> {
    val am = audioManager(context)

    if (preference == "watch_speaker") {
      val started = startScoRoute(context, am)
      if (started != null && started["scoOn"] == true) {
        return mapOf(
          "label" to (started["label"] ?: "Watch speaker (HFP)"),
          "kind" to "watch_speaker",
          "applied" to true,
          "scoOn" to true,
        )
      }
      return mapOf(
        "label" to "Watch speaker unavailable — phone",
        "kind" to "phone_speaker",
        "applied" to false,
        "scoOn" to false,
      )
    }

    stopInputRoute(context)

    try {
      am.mode = AudioManager.MODE_NORMAL
      when (preference) {
        "bluetooth" -> {
          val bt = findBluetoothA2dpOutput(am) ?: findScoOutput(am)
          if (bt != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            am.setCommunicationDevice(bt)
            return mapOf(
              "label" to deviceLabel(bt, "Bluetooth"),
              "kind" to "bluetooth",
              "applied" to true,
            )
          }
          am.isSpeakerphoneOn = false
          return mapOf(
            "label" to "Bluetooth (best-effort)",
            "kind" to "bluetooth",
            "applied" to (bt != null),
          )
        }
        "earbuds" -> {
          val wired = findWiredOutput(am)
          if (wired != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            am.setCommunicationDevice(wired)
            return mapOf(
              "label" to deviceLabel(wired, "Earbuds"),
              "kind" to "earbuds",
              "applied" to true,
            )
          }
          am.isSpeakerphoneOn = false
          return mapOf(
            "label" to "Earbuds (best-effort)",
            "kind" to "earbuds",
            "applied" to (wired != null),
          )
        }
        else -> {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            am.clearCommunicationDevice()
          }
          am.isSpeakerphoneOn = true
          return mapOf(
            "label" to "Phone speaker",
            "kind" to "phone_speaker",
            "applied" to true,
          )
        }
      }
    } catch (_: Exception) {
      return mapOf(
        "label" to "Phone speaker",
        "kind" to "phone_speaker",
        "applied" to false,
      )
    }
  }

  private fun startScoRoute(context: Context, am: AudioManager): Map<String, Any>? {
    val headset = probeHeadset(context)
    val scoIn = findScoInput(am)
    if (!headset.connected && scoIn == null) {
      return null
    }

    try {
      val telecomUp = SteroCallSession.isActive()
      val label = findScoInput(am)?.let { deviceLabel(it, null) }
        ?: headset.name
        ?: "Watch HFP"

      if (telecomUp) {
        // Telecom owns SCO. Do not startBluetoothSco / MODE_IN_CALL — that
        // drops the watch native in-call UI.
        HeadsetVrWatcher.markOurSco(true)
        val ready = isVirtualCallUp(context, am)
        Log.i("SteroAudioRoute", "telecom call up sco=$ready label=$label")
        return mapOf(
          "label" to label,
          "kind" to "watch_hfp",
          "scoOn" to true,
          "hfpAvailable" to true,
        )
      }

      if (isVirtualCallUp(context, am)) {
        HeadsetVrWatcher.markOurSco(true)
        Log.i("SteroAudioRoute", "call audio already up label=$label")
        return mapOf(
          "label" to label,
          "kind" to "watch_hfp",
          "scoOn" to true,
          "hfpAvailable" to true,
        )
      }

      am.mode = AudioManager.MODE_IN_COMMUNICATION
      am.isSpeakerphoneOn = false

      val routeDevice = findScoInput(am) ?: findScoOutput(am)
      if (routeDevice != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        am.setCommunicationDevice(routeDevice)
      }

      HeadsetVrWatcher.markOurSco(true)
      kickBluetoothSco(am)

      var ready = false
      repeat(40) { tick ->
        try {
          Thread.sleep(100)
        } catch (_: InterruptedException) {
          // ignore
        }
        if (isVirtualCallUp(context, am)) {
          ready = true
          return@repeat
        }
        if (tick % 5 == 4) {
          kickBluetoothSco(am)
        }
      }

      ready = isVirtualCallUp(context, am)
      val scoOn = am.isBluetoothScoOn
      val audio = isHeadsetAudioConnected(context)
      Log.i(
        "SteroAudioRoute",
        "virtualCall ready=$ready scoOn=$scoOn audio=$audio",
      )

      return mapOf(
        "label" to label,
        "kind" to if (ready) "watch_hfp" else "phone",
        "scoOn" to ready,
        "hfpAvailable" to true,
      )
    } catch (_: Exception) {
      return null
    }
  }

  private fun isHeadsetAudioConnected(context: Context): Boolean {
    var connected = false
    withHeadset(context) { _, proxy ->
      connected = proxy.connectedDevices.any { device ->
        try {
          proxy.isAudioConnected(device)
        } catch (_: Exception) {
          false
        }
      }
    }
    return connected
  }

  private fun kickBluetoothSco(am: AudioManager) {
    try {
      am.startBluetoothSco()
      am.isBluetoothScoOn = true
    } catch (_: Exception) {
      // ignore
    }
  }

  /** Real HFP call link only — a listed SCO *device* is not enough (ghost after HandsFree). */
  private fun isVirtualCallUp(context: Context, am: AudioManager): Boolean {
    return am.isBluetoothScoOn || isHeadsetAudioConnected(context)
  }

  private data class HeadsetProbe(val connected: Boolean, val name: String?)

  private fun probeHeadset(context: Context): HeadsetProbe {
    var connected = false
    var name: String? = null
    withHeadset(context) { _, proxy ->
      val devices = proxy.connectedDevices
      connected = devices.isNotEmpty()
      name = devices.firstOrNull()?.name?.trim()?.ifEmpty { null }
    }
    if (!connected) {
      // Fall back to AudioManager SCO device presence.
      val am = audioManager(context)
      val sco = findScoInput(am) ?: findScoOutput(am)
      if (sco != null) {
        return HeadsetProbe(true, deviceLabel(sco, null))
      }
    }
    return HeadsetProbe(connected, name)
  }

  private fun withHeadset(
    context: Context,
    block: (BluetoothAdapter, BluetoothHeadset) -> Unit,
  ) {
    val adapter = BluetoothAdapter.getDefaultAdapter() ?: return
    if (!adapter.isEnabled) return

    val holder = AtomicReference<BluetoothHeadset>()
    val latch = CountDownLatch(1)
    val listener = object : BluetoothProfile.ServiceListener {
      override fun onServiceConnected(profile: Int, proxy: BluetoothProfile) {
        if (profile == BluetoothProfile.HEADSET) {
          holder.set(proxy as BluetoothHeadset)
        }
        latch.countDown()
      }

      override fun onServiceDisconnected(profile: Int) {
        // ignore
      }
    }

    val bound = try {
      adapter.getProfileProxy(context.applicationContext, listener, BluetoothProfile.HEADSET)
    } catch (_: SecurityException) {
      false
    } catch (_: Exception) {
      false
    }
    if (!bound) return

    try {
      latch.await(800, TimeUnit.MILLISECONDS)
      val proxy = holder.get() ?: return
      try {
        block(adapter, proxy)
      } finally {
        try {
          adapter.closeProfileProxy(BluetoothProfile.HEADSET, proxy)
        } catch (_: Exception) {
          // ignore
        }
      }
    } catch (_: Exception) {
      // ignore
    }
  }

  private fun audioManager(context: Context): AudioManager {
    return context.applicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  }

  private fun findScoInput(am: AudioManager): AudioDeviceInfo? {
    return am.getDevices(AudioManager.GET_DEVICES_INPUTS).firstOrNull {
      it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO
    }
  }

  private fun findScoOutput(am: AudioManager): AudioDeviceInfo? {
    return am.getDevices(AudioManager.GET_DEVICES_OUTPUTS).firstOrNull {
      it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO
    }
  }

  private fun findBluetoothA2dpOutput(am: AudioManager): AudioDeviceInfo? {
    return am.getDevices(AudioManager.GET_DEVICES_OUTPUTS).firstOrNull {
      it.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP
    }
  }

  private fun findWiredOutput(am: AudioManager): AudioDeviceInfo? {
    return am.getDevices(AudioManager.GET_DEVICES_OUTPUTS).firstOrNull {
      it.type == AudioDeviceInfo.TYPE_WIRED_HEADSET ||
        it.type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
        it.type == AudioDeviceInfo.TYPE_USB_HEADSET
    }
  }

  private fun deviceLabel(device: AudioDeviceInfo, fallback: String?): String {
    val name = device.productName?.toString()?.trim().orEmpty()
    return when {
      name.isNotEmpty() -> name
      fallback != null -> fallback
      else -> "Watch HFP"
    }
  }
}
