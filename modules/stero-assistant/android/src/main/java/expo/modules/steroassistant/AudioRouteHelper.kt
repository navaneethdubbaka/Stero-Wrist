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

    val hfp = findHfpDevice(am)
    if (hfp == null) {
      stopInputRoute(context)
      return getActiveInputInfo(context)
    }

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        am.setCommunicationDevice(hfp)
      }
      am.mode = AudioManager.MODE_IN_COMMUNICATION
      am.startBluetoothSco()
      am.isBluetoothScoOn = true
    } catch (_: Exception) {
      stopInputRoute(context)
      return getActiveInputInfo(context)
    }

    // Brief settle so SCO can connect before SpeechRecognizer starts.
    try {
      Thread.sleep(350)
    } catch (_: InterruptedException) {
      // ignore
    }

    return getActiveInputInfo(context)
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
   * Prefer playback output after SCO teardown. Best-effort; no OEM watch-speaker hacks.
   * preference: phone_speaker | earbuds | bluetooth
   */
  fun preferOutputRoute(context: Context, preference: String): Map<String, Any> {
    val am = audioManager(context)
    // Ensure SCO is down so A2DP / speaker can take over for media playback.
    stopInputRoute(context)

    try {
      am.mode = AudioManager.MODE_NORMAL
      when (preference) {
        "bluetooth" -> {
          val bt = findBluetoothOutput(am)
          if (bt != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            am.setCommunicationDevice(bt)
            return mapOf(
              "label" to deviceLabel(bt, "Bluetooth"),
              "kind" to "bluetooth",
              "applied" to true,
            )
          }
          // Pre-S: speakerphone off lets BT A2DP reclaim media when available.
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

  private fun audioManager(context: Context): AudioManager {
    return context.applicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  }

  private fun findHfpDevice(am: AudioManager): AudioDeviceInfo? {
    val devices = am.getDevices(AudioManager.GET_DEVICES_INPUTS)
    return devices.firstOrNull {
      it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO
    }
  }

  private fun findBluetoothOutput(am: AudioManager): AudioDeviceInfo? {
    val devices = am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
    return devices.firstOrNull {
      it.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP ||
        it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO
    }
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
