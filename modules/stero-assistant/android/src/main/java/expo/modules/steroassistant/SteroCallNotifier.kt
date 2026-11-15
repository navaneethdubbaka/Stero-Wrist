package expo.modules.steroassistant

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.app.Person
import android.os.Build

/**
 * Ongoing CallStyle notification so the system treats the session as a live call.
 */
object SteroCallNotifier {
  private const val CHANNEL_ID = "stero_call"
  private const val NOTIFICATION_ID = 58052

  fun show(context: Context) {
    val app = context.applicationContext
    ensureChannel(app)
    val hangup = PendingIntent.getBroadcast(
      app,
      0,
      Intent(app, SteroCallHangupReceiver::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(app, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(app)
    }
    builder
      .setSmallIcon(android.R.drawable.stat_sys_phone_call)
      .setContentTitle("Call answered")
      .setContentText("Stero")
      .setOngoing(true)
      .setCategory(Notification.CATEGORY_CALL)
      .setVisibility(Notification.VISIBILITY_PUBLIC)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val person = Person.Builder()
        .setName("Stero")
        .setImportant(true)
        .build()
      builder.setStyle(Notification.CallStyle.forOngoingCall(person, hangup))
    } else {
      builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "Hang up", hangup)
    }

    try {
      val nm = app.getSystemService(NotificationManager::class.java) ?: return
      nm.notify(NOTIFICATION_ID, builder.build())
    } catch (e: Exception) {
      android.util.Log.w("SteroCall", "notify: ${e.message}")
    }
  }

  fun hide(context: Context) {
    try {
      val nm = context.applicationContext.getSystemService(NotificationManager::class.java)
      nm?.cancel(NOTIFICATION_ID)
    } catch (_: Exception) {
      // ignore
    }
  }

  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val mgr = context.getSystemService(NotificationManager::class.java) ?: return
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Stero call",
      NotificationManager.IMPORTANCE_DEFAULT,
    )
    channel.description = "Shown while Stero is in a watch call"
    channel.setSound(null, null)
    mgr.createNotificationChannel(channel)
  }
}

class SteroCallHangupReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    SteroCallSession.endAnsweredCall()
    try {
      SteroOverlayBridge.requestCancelFromUi()
    } catch (_: Exception) {
      // ignore
    }
  }
}
