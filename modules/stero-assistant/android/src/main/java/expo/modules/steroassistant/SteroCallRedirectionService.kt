package expo.modules.steroassistant

import android.net.Uri
import android.os.Build
import android.telecom.CallRedirectionService
import android.telecom.PhoneAccountHandle
import android.telephony.PhoneNumberUtils
import android.util.Log

/**
 * Intercepts only the configured dial-pad code (default 010). Other GSM calls
 * proceed unmodified. Stero's self-managed watch call is never cancelled.
 */
class SteroCallRedirectionService : CallRedirectionService() {
  override fun onPlaceCall(
    handle: Uri,
    initialPhoneAccount: PhoneAccountHandle,
    allowInteractiveResponse: Boolean,
  ) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      placeCallUnmodified()
      return
    }
    try {
      val ours = SteroCallSession.accountHandle(applicationContext)
      if (
        initialPhoneAccount.componentName == ours.componentName &&
        initialPhoneAccount.id == ours.id
      ) {
        Log.i(TAG, "leave Stero watch account unmodified")
        placeCallUnmodified()
        return
      }
      if (isEmergency(handle)) {
        placeCallUnmodified()
        return
      }
      val code = SteroDialPadPrefs.getCode(applicationContext)
      if (!SteroDialPadPrefs.matches(handle, code)) {
        placeCallUnmodified()
        return
      }
      Log.i(TAG, "cancel GSM $handle → Stero dial-pad")
      cancelCall()
      SteroOverlayBridge.launchDialPadSession(applicationContext)
    } catch (e: Exception) {
      Log.w(TAG, "onPlaceCall: ${e.message}")
      try {
        placeCallUnmodified()
      } catch (_: Exception) {
        // Telecom will drop the call after 5s if we never answered.
      }
    }
  }

  private fun isEmergency(handle: Uri): Boolean {
    val raw = handle.schemeSpecificPart.orEmpty()
    if (raw.isBlank()) return false
    val digits = SteroDialPadPrefs.digitsOnly(raw)
    if (digits in EMERGENCY) return true
    return try {
      @Suppress("DEPRECATION")
      PhoneNumberUtils.isEmergencyNumber(raw) ||
        (digits.isNotEmpty() && PhoneNumberUtils.isEmergencyNumber(digits))
    } catch (_: Exception) {
      false
    }
  }

  companion object {
    private const val TAG = "SteroDialPad"
    private val EMERGENCY = setOf("112", "911", "999", "000", "110", "119", "122")
  }
}
