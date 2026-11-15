package expo.modules.steroassistant

import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.telecom.CallAudioState
import android.telecom.CallEndpoint
import android.telecom.Connection
import android.telecom.ConnectionRequest
import android.telecom.ConnectionService
import android.telecom.DisconnectCause
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import android.util.Log
import java.util.concurrent.Executor

class SteroConnectionService : ConnectionService() {
  override fun onCreateOutgoingConnection(
    connectionManagerPhoneAccount: PhoneAccountHandle?,
    request: ConnectionRequest?,
  ): Connection {
    val address = request?.address ?: SteroCallSession.CALL_URI
    val conn = SteroWatchConnection(applicationContext, address)
    conn.setDialing()
    conn.scheduleAnswered()
    Log.i(TAG, "outgoing DIALING, will answer")
    return conn
  }

  override fun onCreateIncomingConnection(
    connectionManagerPhoneAccount: PhoneAccountHandle?,
    request: ConnectionRequest?,
  ): Connection {
    val address = incomingAddress(request)
    val conn = SteroWatchConnection(applicationContext, address)
    conn.setRinging()
    conn.scheduleAnswered()
    Log.i(TAG, "incoming RINGING, will answer")
    return conn
  }

  override fun onCreateIncomingConnectionFailed(
    connectionManagerPhoneAccount: PhoneAccountHandle?,
    request: ConnectionRequest?,
  ) {
    Log.w(TAG, "onCreateIncomingConnectionFailed")
    SteroCallSession.placeOutgoingFallback(applicationContext)
  }

  override fun onCreateOutgoingConnectionFailed(
    connectionManagerPhoneAccount: PhoneAccountHandle?,
    request: ConnectionRequest?,
  ) {
    Log.w(TAG, "onCreateOutgoingConnectionFailed")
  }

  private fun incomingAddress(request: ConnectionRequest?): Uri {
    request?.address?.let { return it }
    val extras: Bundle = request?.extras ?: return SteroCallSession.CALL_URI
    val fromExtras = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      extras.getParcelable(TelecomManager.EXTRA_INCOMING_CALL_ADDRESS, Uri::class.java)
    } else {
      @Suppress("DEPRECATION")
      extras.getParcelable(TelecomManager.EXTRA_INCOMING_CALL_ADDRESS)
    }
    return fromExtras ?: SteroCallSession.CALL_URI
  }

  companion object {
    private const val TAG = "SteroCall"
  }
}

class SteroWatchConnection(
  private val appContext: Context,
  address: Uri,
) : Connection() {
  private val main = Handler(Looper.getMainLooper())
  @Volatile
  private var tearingDown = false
  private var btRouteTries = 0

  init {
    setConnectionProperties(PROPERTY_SELF_MANAGED)
    setConnectionCapabilities(CAPABILITY_MUTE or CAPABILITY_SUPPORT_HOLD or CAPABILITY_HOLD)
    setAudioModeIsVoip(false)
    setAddress(SteroCallSession.CALL_URI, TelecomManager.PRESENTATION_ALLOWED)
    setCallerDisplayName(SteroCallSession.CALL_NAME, TelecomManager.PRESENTATION_ALLOWED)
    active = this
  }

  fun scheduleAnswered() {
    // Give the watch time to paint incoming/in-call before we go ACTIVE.
    main.postDelayed({
      if (!tearingDown && state != STATE_DISCONNECTED && state != STATE_ACTIVE) {
        answerNow()
      }
    }, 400)
  }

  fun answerNow() {
    if (tearingDown) return
    try {
      setActive()
    } catch (e: Exception) {
      Log.w(TAG, "setActive: ${e.message}")
    }
    setAddress(SteroCallSession.CALL_URI, TelecomManager.PRESENTATION_ALLOWED)
    setCallerDisplayName(SteroCallSession.CALL_NAME, TelecomManager.PRESENTATION_ALLOWED)
    routeBluetooth()
    SteroCallMic.start()
    SteroCallNotifier.show(appContext)
    Log.i(TAG, "connection ACTIVE (call answered)")
  }

  fun disconnectLocal() {
    if (tearingDown) return
    tearingDown = true
    SteroCallMic.stop()
    SteroCallNotifier.hide(appContext)
    try {
      setDisconnected(DisconnectCause(DisconnectCause.LOCAL))
      destroy()
    } catch (_: Exception) {
      // ignore
    }
    if (active === this) active = null
  }

  override fun onAnswer() {
    answerNow()
  }

  override fun onAnswer(videoState: Int) {
    answerNow()
  }

  override fun onDisconnect() {
    val fromTelecom = !tearingDown
    disconnectLocal()
    if (fromTelecom) {
      try {
        SteroOverlayBridge.requestCancelFromUi()
      } catch (_: Exception) {
        // ignore
      }
    }
  }

  override fun onAbort() {
    disconnectLocal()
  }

  override fun onReject() {
    disconnectLocal()
  }

  @Deprecated("Deprecated in Java")
  override fun onCallAudioStateChanged(state: CallAudioState?) {
    super.onCallAudioStateChanged(state)
    if (state == null || tearingDown) return
    Log.i(TAG, "callAudio route=${state.route} masked=${state.supportedRouteMask}")
    if (state.route == CallAudioState.ROUTE_SPEAKER && btRouteTries < 2) {
      btRouteTries++
      routeBluetooth()
    }
  }

  override fun onAvailableCallEndpointsChanged(availableEndpoints: MutableList<CallEndpoint>) {
    super.onAvailableCallEndpointsChanged(availableEndpoints)
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE || tearingDown) return
    val bt = availableEndpoints.firstOrNull {
      it.endpointType == CallEndpoint.TYPE_BLUETOOTH
    } ?: return
    try {
      requestCallEndpointChange(
        bt,
        Executor { it.run() },
        object : android.os.OutcomeReceiver<Void, android.telecom.CallEndpointException> {
          override fun onResult(result: Void?) {
            Log.i(TAG, "endpoint Bluetooth ok")
          }

          override fun onError(error: android.telecom.CallEndpointException) {
            Log.w(TAG, "endpoint Bluetooth: ${error.message}")
          }
        },
      )
    } catch (e: Exception) {
      Log.w(TAG, "requestCallEndpointChange: ${e.message}")
    }
  }

  private fun routeBluetooth() {
    try {
      @Suppress("DEPRECATION")
      setAudioRoute(CallAudioState.ROUTE_BLUETOOTH)
      Log.i(TAG, "setAudioRoute BLUETOOTH")
    } catch (e: Exception) {
      Log.w(TAG, "setAudioRoute BT: ${e.message}")
    }
  }

  companion object {
    private const val TAG = "SteroCall"

    @Volatile
    var active: SteroWatchConnection? = null
  }
}
