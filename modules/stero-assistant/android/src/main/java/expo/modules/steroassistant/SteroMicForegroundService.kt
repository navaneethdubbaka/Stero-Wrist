package expo.modules.steroassistant

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * Foreground service so mic capture can continue with the screen off / locked.
 */
class SteroMicForegroundService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    ensureChannel()
    val notification = buildNotification()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE,
      )
    } else {
      @Suppress("DEPRECATION")
      startForeground(NOTIFICATION_ID, notification)
    }
    return START_STICKY
  }

  override fun onDestroy() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }
    super.onDestroy()
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val mgr = getSystemService(NotificationManager::class.java) ?: return
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Assistant microphone",
      NotificationManager.IMPORTANCE_LOW,
    )
    channel.description = "Shown while Stero Wrist is listening"
    mgr.createNotificationChannel(channel)
  }

  private fun buildNotification(): Notification {
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val pending = if (launch != null) {
      PendingIntent.getActivity(
        this,
        0,
        launch,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    } else {
      null
    }

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }

    return builder
      .setContentTitle("Stero Wrist listening")
      .setContentText("Microphone is active for your assistant request")
      .setSmallIcon(android.R.drawable.ic_btn_speak_now)
      .setContentIntent(pending)
      .setOngoing(true)
      .build()
  }

  companion object {
    private const val CHANNEL_ID = "stero_mic"
    private const val NOTIFICATION_ID = 58051

    fun start(context: Context) {
      val intent = Intent(context, SteroMicForegroundService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, SteroMicForegroundService::class.java))
    }
  }
}
