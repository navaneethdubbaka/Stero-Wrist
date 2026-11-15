package expo.modules.steroassistant

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log

/**
 * Holds a live AudioRecord so the system mic indicator glows and HFP SCO is captured.
 * Stop before expo-speech-recognition persist takes over the same source.
 */
object SteroCallMic {
  private const val TAG = "SteroCall"
  private const val SAMPLE_HZ = 16000

  @Volatile
  private var running = false

  @Volatile
  private var recorder: AudioRecord? = null

  @Synchronized
  @SuppressLint("MissingPermission")
  fun start() {
    if (running && recorder != null) return
    stop()
    val min = AudioRecord.getMinBufferSize(
      SAMPLE_HZ,
      AudioFormat.CHANNEL_IN_MONO,
      AudioFormat.ENCODING_PCM_16BIT,
    )
    if (min <= 0) {
      Log.w(TAG, "AudioRecord min buffer invalid")
      return
    }
    val rec = try {
      AudioRecord(
        MediaRecorder.AudioSource.VOICE_COMMUNICATION,
        SAMPLE_HZ,
        AudioFormat.CHANNEL_IN_MONO,
        AudioFormat.ENCODING_PCM_16BIT,
        min * 2,
      )
    } catch (e: Exception) {
      Log.w(TAG, "AudioRecord create: ${e.message}")
      return
    }
    if (rec.state != AudioRecord.STATE_INITIALIZED) {
      rec.release()
      Log.w(TAG, "AudioRecord not initialized")
      return
    }
    try {
      rec.startRecording()
    } catch (e: Exception) {
      rec.release()
      Log.w(TAG, "startRecording: ${e.message}")
      return
    }
    recorder = rec
    running = true
    Thread({
      val buf = ShortArray((min / 2).coerceAtLeast(160))
      while (running) {
        val current = recorder ?: break
        try {
          val n = current.read(buf, 0, buf.size)
          if (n < 0) break
        } catch (_: Exception) {
          break
        }
      }
    }, "stero-call-mic").start()
    Log.i(TAG, "AudioRecord started (mic indicator)")
  }

  @Synchronized
  fun stop() {
    running = false
    val rec = recorder
    recorder = null
    if (rec == null) return
    try {
      rec.stop()
    } catch (_: Exception) {
      // ignore
    }
    try {
      rec.release()
    } catch (_: Exception) {
      // ignore
    }
    Log.i(TAG, "AudioRecord stopped")
  }
}
