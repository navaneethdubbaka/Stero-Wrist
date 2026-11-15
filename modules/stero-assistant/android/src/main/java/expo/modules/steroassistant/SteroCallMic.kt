package expo.modules.steroassistant

import android.annotation.SuppressLint
import android.content.Context
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Holds a live AudioRecord so the system mic indicator glows and HFP SCO is
 * captured to a WAV file. Hang-up transcribes that file (device or custom STT).
 */
object SteroCallMic {
  private const val TAG = "SteroCall"
  private const val SAMPLE_HZ = 16000

  @Volatile
  private var running = false

  @Volatile
  private var recorder: AudioRecord? = null

  @Volatile
  private var app: Context? = null

  @Volatile
  private var pcmFile: File? = null

  @Volatile
  var lastWavPath: String? = null
    private set

  @Synchronized
  @SuppressLint("MissingPermission")
  fun start(context: Context? = null) {
    if (context != null) {
      app = context.applicationContext
    }
    if (running && recorder != null) return
    stop()
    val ctx = app ?: return
    val min = AudioRecord.getMinBufferSize(
      SAMPLE_HZ,
      AudioFormat.CHANNEL_IN_MONO,
      AudioFormat.ENCODING_PCM_16BIT,
    )
    if (min <= 0) {
      Log.w(TAG, "AudioRecord min buffer invalid")
      return
    }
    // MIC follows Telecom's HFP route. VOICE_COMMUNICATION forces
    // MODE_IN_COMMUNICATION and drops the watch to earpiece.
    val rec = try {
      AudioRecord(
        MediaRecorder.AudioSource.MIC,
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
    val pcm = File(ctx.cacheDir, "stero-watch-${System.currentTimeMillis()}.pcm")
    pcmFile = pcm
    lastWavPath = null
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
      val bytes = ByteArray(buf.size * 2)
      try {
        FileOutputStream(pcm).use { out ->
          while (running) {
            val current = recorder ?: break
            val n = try {
              current.read(buf, 0, buf.size)
            } catch (_: Exception) {
              break
            }
            if (n < 0) break
            if (n == 0) continue
            var o = 0
            for (i in 0 until n) {
              val s = buf[i].toInt()
              bytes[o++] = (s and 0xff).toByte()
              bytes[o++] = ((s shr 8) and 0xff).toByte()
            }
            out.write(bytes, 0, n * 2)
          }
        }
      } catch (e: Exception) {
        Log.w(TAG, "pcm write: ${e.message}")
      }
    }, "stero-call-mic").start()
    Log.i(TAG, "AudioRecord started (mic indicator)")
  }

  @Synchronized
  fun stop() {
    running = false
    try {
      Thread.sleep(80)
    } catch (_: InterruptedException) {
      // ignore
    }
    val rec = recorder
    recorder = null
    if (rec != null) {
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
    }
    exportWavLocked()
    Log.i(TAG, "AudioRecord stopped wav=${lastWavPath ?: "none"}")
  }

  fun takeLastWav(): String? {
    if (running) stop()
    return lastWavPath
  }

  private fun exportWavLocked() {
    val pcm = pcmFile ?: return
    pcmFile = null
    if (!pcm.exists() || pcm.length() < 3200) {
      Log.w(TAG, "pcm too short (${pcm.length()} bytes)")
      pcm.delete()
      return
    }
    val ctx = app ?: return
    val wav = File(ctx.cacheDir, pcm.nameWithoutExtension + ".wav")
    try {
      writeWav(pcm, wav)
      lastWavPath = wav.absolutePath
      Log.i(TAG, "watch recording ${wav.length()} bytes")
    } catch (e: Exception) {
      Log.w(TAG, "wav export: ${e.message}")
    }
    pcm.delete()
  }

  private fun writeWav(pcm: File, wav: File) {
    val dataLen = pcm.length().toInt()
    val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN)
    header.put("RIFF".toByteArray(Charsets.US_ASCII))
    header.putInt(36 + dataLen)
    header.put("WAVE".toByteArray(Charsets.US_ASCII))
    header.put("fmt ".toByteArray(Charsets.US_ASCII))
    header.putInt(16)
    header.putShort(1) // PCM
    header.putShort(1) // mono
    header.putInt(SAMPLE_HZ)
    header.putInt(SAMPLE_HZ * 2)
    header.putShort(2) // block align
    header.putShort(16) // bits
    header.put("data".toByteArray(Charsets.US_ASCII))
    header.putInt(dataLen)
    FileOutputStream(wav).use { out ->
      out.write(header.array())
      pcm.inputStream().use { it.copyTo(out) }
    }
  }
}
