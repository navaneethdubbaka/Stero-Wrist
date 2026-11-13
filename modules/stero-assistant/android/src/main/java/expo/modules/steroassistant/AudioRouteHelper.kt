package expo.modules.steroassistant

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build

object AudioRouteHelper {
  fun getActiveInputInfo(context: Context): Map<String, Any> {
    val am = audioManager(context)
    val hfp = findHfpDevice(am)
    val scoOn = am.isBluetoothScoOn
    return when {
      scoOn && hfp != null -> mapOf(
        "label" to deviceLabel(hfp, "Watch HFP"),
        "kind" to "watch_hfp",
        "scoOn" to true,
        "hfpAvailable" to true,
      )
      hfp != null -> mapOf(
        "label" to "Phone mic (HFP available)",
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
    return startScoRoute(am) ?: getActiveInputInfo(context)
  }

  fun stopInputRoute(context: Context) {
    val am = audioManager(context)
    try {
      if (am.isBluetoothScoOn) {
        am.isBluetoothScoOn = false
        am.stopBluetoothSco()
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        am.clearCommunicationDevice()
      }
      am.mode = AudioManager.MODE_NORMAL
    } catch (_: Exception) {
      // Best-effort teardown.
    }
  }

  /**
   * Prefer playback output.
   * - phone_speaker / earbuds / bluetooth (A2DP): SCO down, then route
   * - watch_speaker: keep/start HFP SCO so watch earpiece/speaker gets call-path audio
   */
  fun preferOutputRoute(context: Context, preference: String): Map<String, Any> {
    val am = audioManager(context)

    if (preference == "watch_speaker") {
      val started = startScoRoute(am)
      if (started != null) {
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

    // Non-watch: tear down SCO so A2DP / speaker can take over.
    stopInputRoute(context)

    try {
      am.mode = AudioManager.MODE_NORMAL
      when (preference) {
        "bluetooth" -> {
          val bt = findBluetoothA2dpOutput(am) ?: findBluetoothOutput(am)
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

  private fun startScoRoute(am: AudioManager): Map<String, Any>? {
    val hfp = findHfpDevice(am) ?: findBluetoothScoOutput(am) ?: return null
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        am.setCommunicationDevice(hfp)
      }
      am.mode = AudioManager.MODE_IN_COMMUNICATION
      am.isSpeakerphoneOn = false
      am.startBluetoothSco()
      am.isBluetoothScoOn = true
      try {
        Thread.sleep(350)
      } catch (_: InterruptedException) {
        // ignore
      }
      return mapOf(
        "label" to deviceLabel(hfp, "Watch HFP"),
        "kind" to "watch_hfp",
        "scoOn" to am.isBluetoothScoOn,
        "hfpAvailable" to true,
      )
    } catch (_: Exception) {
      return null
    }
  }

  private fun audioManager(context: Context): AudioManager {
    return context.applicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  }

  private fun findHfpDevice(am: AudioManager): AudioDeviceInfo? {
    val devices = am.getDevices(AudioManager.GET_DEVICES_INPUTS)
    return devices.firstOrNull {
      it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO
    }
  }

  private fun findBluetoothScoOutput(am: AudioManager): AudioDeviceInfo? {
    val devices = am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
    return devices.firstOrNull {
      it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO
    }
  }

  private fun findBluetoothA2dpOutput(am: AudioManager): AudioDeviceInfo? {
    val devices = am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
    return devices.firstOrNull {
      it.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP
    }
  }

  private fun findBluetoothOutput(am: AudioManager): AudioDeviceInfo? {
    return findBluetoothA2dpOutput(am) ?: findBluetoothScoOutput(am)
  }

  private fun findWiredOutput(am: AudioManager): AudioDeviceInfo? {
    val devices = am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
    return devices.firstOrNull {
      it.type == AudioDeviceInfo.TYPE_WIRED_HEADSET ||
        it.type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
        it.type == AudioDeviceInfo.TYPE_USB_HEADSET
    }
  }

  private fun deviceLabel(device: AudioDeviceInfo, fallback: String): String {
    val name = device.productName?.toString()?.trim().orEmpty()
    return if (name.isNotEmpty()) name else fallback
  }
}
