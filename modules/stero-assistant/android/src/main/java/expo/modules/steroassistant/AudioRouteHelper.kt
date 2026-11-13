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

  private fun audioManager(context: Context): AudioManager {
    return context.applicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  }

  private fun findHfpDevice(am: AudioManager): AudioDeviceInfo? {
    val devices = am.getDevices(AudioManager.GET_DEVICES_INPUTS)
    return devices.firstOrNull {
      it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO
    }
  }

  private fun deviceLabel(device: AudioDeviceInfo, fallback: String): String {
    val name = device.productName?.toString()?.trim().orEmpty()
    return if (name.isNotEmpty()) name else fallback
  }
}
