package expo.modules.steroassistant

import android.content.ComponentName
import android.content.Context
import android.net.Uri
import android.os.Bundle
import android.telecom.Connection
import android.telecom.PhoneAccount
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import android.util.Log

/**
 * Self-managed Telecom call so the watch HFP stack sees a real answered call
 * (AT+CIEV call=1) instead of voice-recognition (AT+BVRA).
 */
object SteroCallSession {
  private const val TAG = "SteroCall"
  private const val ACCOUNT_ID = "stero_watch_call"
  const val CALL_NAME = "Stero"
  const val CALL_NUMBER = "010"

  val CALL_URI: Uri = Uri.fromParts(PhoneAccount.SCHEME_TEL, CALL_NUMBER, null)

  @Volatile
  private var placed = false

  fun isActive(): Boolean {
    return SteroWatchConnection.active?.state == Connection.STATE_ACTIVE
  }

  fun startAnsweredCall(context: Context) {
    if (isActive() || SteroWatchConnection.active != null) return
    placed = false
    val app = context.applicationContext
    val tm = app.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager ?: return
    val handle = registerAccount(app, tm)

    val incomingOk = try {
      tm.isIncomingCallPermitted(handle)
    } catch (e: Exception) {
      Log.w(TAG, "isIncomingCallPermitted: ${e.message}")
      true
    }
    val account = try {
      tm.getPhoneAccount(handle)
    } catch (_: Exception) {
      null
    }
    Log.i(
      TAG,
      "account enabled=${account?.isEnabled} incomingOk=$incomingOk",
    )

    placed = true
    if (incomingOk) {
      try {
        val extras = Bundle().apply {
          putParcelable(TelecomManager.EXTRA_INCOMING_CALL_ADDRESS, CALL_URI)
        }
        tm.addNewIncomingCall(handle, extras)
        Log.i(TAG, "addNewIncomingCall Stero")
        return
      } catch (e: SecurityException) {
        Log.w(TAG, "addNewIncomingCall denied: ${e.message}")
      } catch (e: Exception) {
        Log.w(TAG, "addNewIncomingCall failed: ${e.message}")
      }
    }
    placed = false
    placeOutgoingFallback(app)
  }

  fun placeOutgoingFallback(context: Context) {
    if (isActive()) return
    val app = context.applicationContext
    val tm = app.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager ?: return
    val handle = registerAccount(app, tm)
    val outgoingOk = try {
      tm.isOutgoingCallPermitted(handle)
    } catch (e: Exception) {
      Log.w(TAG, "isOutgoingCallPermitted: ${e.message}")
      true
    }
    if (!outgoingOk) {
      Log.w(TAG, "outgoing call not permitted")
      return
    }
    try {
      val extras = Bundle().apply {
        putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, handle)
        putBoolean(TelecomManager.EXTRA_START_CALL_WITH_SPEAKERPHONE, false)
      }
      placed = true
      tm.placeCall(CALL_URI, extras)
      Log.i(TAG, "placeCall self-managed Stero fallback")
    } catch (e: SecurityException) {
      placed = false
      Log.w(TAG, "placeCall denied: ${e.message}")
    } catch (e: Exception) {
      placed = false
      Log.w(TAG, "placeCall failed: ${e.message}")
    }
  }

  fun awaitActive(timeoutMs: Long): Boolean {
    val deadline = System.currentTimeMillis() + timeoutMs
    while (System.currentTimeMillis() < deadline) {
      if (isActive()) return true
      try {
        Thread.sleep(50)
      } catch (_: InterruptedException) {
        return isActive()
      }
    }
    return isActive()
  }

  fun endAnsweredCall() {
    placed = false
    try {
      SteroWatchConnection.active?.disconnectLocal()
    } catch (e: Exception) {
      Log.w(TAG, "end call: ${e.message}")
    }
  }

  fun accountHandle(context: Context): PhoneAccountHandle {
    return PhoneAccountHandle(
      ComponentName(context, SteroConnectionService::class.java),
      ACCOUNT_ID,
    )
  }

  private fun registerAccount(app: Context, tm: TelecomManager): PhoneAccountHandle {
    val handle = accountHandle(app)
    val account = PhoneAccount.builder(handle, CALL_NAME)
      .setCapabilities(PhoneAccount.CAPABILITY_SELF_MANAGED)
      .addSupportedUriScheme(PhoneAccount.SCHEME_TEL)
      .setShortDescription("Stero watch call")
      .build()
    tm.registerPhoneAccount(account)
    return handle
  }
}
