package expo.modules.steroassistant

import android.content.Context
import android.net.Uri
import android.telephony.PhoneNumberUtils

object SteroDialPadPrefs {
  private const val PREFS = "stero_dial_pad"
  private const val KEY_CODE = "dial_pad_code"
  const val DEFAULT_CODE = "010"

  fun getCode(context: Context): String {
    val raw = context.applicationContext
      .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .getString(KEY_CODE, DEFAULT_CODE)
      ?: DEFAULT_CODE
    val trimmed = raw.trim()
    return if (trimmed.isEmpty()) DEFAULT_CODE else trimmed
  }

  fun setCode(context: Context, code: String) {
    val trimmed = code.trim()
    val stored = digitsOnly(trimmed).ifEmpty { DEFAULT_CODE }
    context.applicationContext
      .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_CODE, stored)
      .apply()
  }

  fun digitsOnly(value: String): String {
    return value.filter { it.isDigit() }
  }

  fun matches(handle: Uri, configured: String): Boolean {
    val code = digitsOnly(configured).ifEmpty { digitsOnly(DEFAULT_CODE) }
    if (code.isEmpty()) return false
    val ssp = handle.schemeSpecificPart?.trim().orEmpty()
    if (ssp == configured.trim() || ssp == code) return true
    val digits = digitsOnly(ssp)
    if (digits == code) return true
    if (digits.isNotEmpty() && digits.endsWith(code)) return true
    val stripped = try {
      PhoneNumberUtils.stripSeparators(ssp).orEmpty()
    } catch (_: Exception) {
      ""
    }
    val strippedDigits = digitsOnly(stripped)
    return strippedDigits == code ||
      (strippedDigits.isNotEmpty() && strippedDigits.endsWith(code))
  }
}
