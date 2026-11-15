package expo.modules.steroassistant

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Handler
import android.os.Looper
import android.util.Log
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Short beep routed over HFP SCO (watch speaker) before phone STT starts.
 */
object ListenCueHelper {
  private const val TAG = "SteroListenCue"
  private val mainHandler = Handler(Looper.getMainLooper())

  /**
   * Blocks until the beep has played and SCO has been held long enough
   * for the watch speaker to actually emit it (~800ms after tone start).
   */
  fun playReadyBeepBlocking(context: Context) {
    val app = context.applicationContext
    val am = app.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    try {
      if (SteroCallSession.isActive()) {
        // Telecom already owns HFP. Changing mode/SCO drops the watch mic.
      } else {
        if (!am.isBluetoothScoOn) {
          AudioRouteHelper.startInputRoute(app, preferWatch = true)
        }
        am.mode = AudioManager.MODE_IN_COMMUNICATION
        am.isSpeakerphoneOn = false
        HeadsetVrWatcher.markOurSco(true)
        if (!am.isBluetoothScoOn) {
          am.startBluetoothSco()
          am.isBluetoothScoOn = true
          try {
            Thread.sleep(300)
          } catch (_: InterruptedException) {
            // ignore
          }
        }
      }
    } catch (e: Exception) {
      Log.w(TAG, "SCO prep failed: ${e.message}")
    }

    val latch = CountDownLatch(1)
    mainHandler.post {
      var tone: ToneGenerator? = null
      try {
        tone = ToneGenerator(AudioManager.STREAM_VOICE_CALL, 100)
        tone.startTone(ToneGenerator.TONE_PROP_ACK, 280)
        Log.i(TAG, "Watch listen cue playing (VOICE_CALL / SCO)")
        // Hold SCO while the chirp finishes — do not return early.
        mainHandler.postDelayed({
          try {
            tone?.stopTone()
            tone?.release()
          } catch (_: Exception) {
            // ignore
          }
          latch.countDown()
        }, 750)
      } catch (e: Exception) {
        Log.w(TAG, "VOICE_CALL tone failed: ${e.message}")
        try {
          tone?.release()
        } catch (_: Exception) {
          // ignore
        }
        try {
          val fallback = ToneGenerator(AudioManager.STREAM_MUSIC, 90)
          fallback.startTone(ToneGenerator.TONE_PROP_BEEP, 220)
          mainHandler.postDelayed({
            try {
              fallback.stopTone()
              fallback.release()
            } catch (_: Exception) {
              // ignore
            }
            latch.countDown()
          }, 500)
        } catch (e2: Exception) {
          Log.w(TAG, "fallback beep failed: ${e2.message}")
          latch.countDown()
        }
      }
    }

    try {
      latch.await(2000, TimeUnit.MILLISECONDS)
    } catch (_: InterruptedException) {
      // ignore
    }
  }

  /**
   * Short confirmation beep after a transcript is finalized.
   * Plays on watch SCO when still up; otherwise phone STREAM_MUSIC.
   */
  fun playTranscriptBeepBlocking(context: Context) {
    val app = context.applicationContext
    val am = app.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    try {
      if (am.isBluetoothScoOn) {
        am.mode = AudioManager.MODE_IN_COMMUNICATION
        am.isSpeakerphoneOn = false
        HeadsetVrWatcher.markOurSco(true)
      }
    } catch (_: Exception) {
      // ignore
    }

    val latch = CountDownLatch(1)
    mainHandler.post {
      val sco = try {
        am.isBluetoothScoOn
      } catch (_: Exception) {
        false
      }
      try {
        val stream =
          if (sco) AudioManager.STREAM_VOICE_CALL else AudioManager.STREAM_MUSIC
        val tone = ToneGenerator(stream, 100)
        tone.startTone(ToneGenerator.TONE_PROP_BEEP, 160)
        Log.i(TAG, "Transcript cue playing stream=$stream sco=$sco")
        mainHandler.postDelayed({
          try {
            tone.stopTone()
            tone.release()
          } catch (_: Exception) {
            // ignore
          }
          latch.countDown()
        }, 280)
      } catch (e: Exception) {
        Log.w(TAG, "transcript cue failed: ${e.message}")
        latch.countDown()
      }
    }

    try {
      latch.await(500, TimeUnit.MILLISECONDS)
    } catch (_: InterruptedException) {
      // ignore
    }
  }
}
