package expo.modules.steroassistant

import android.content.Context
import android.util.Log
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.util.concurrent.TimeUnit

object FishAudioTtsClient {
  private const val TAG = "SteroTts"
  private const val URL = "https://api.fish.audio/v1/tts"

  fun synthesize(
    context: Context,
    apiKey: String,
    model: String,
    jsonBody: String,
  ): String {
    val client = OkHttpClient.Builder()
      .connectTimeout(20, TimeUnit.SECONDS)
      .writeTimeout(30, TimeUnit.SECONDS)
      .readTimeout(60, TimeUnit.SECONDS)
      .callTimeout(75, TimeUnit.SECONDS)
      .build()
    val req = Request.Builder()
      .url(URL)
      .header("Authorization", "Bearer $apiKey")
      .header("Content-Type", "application/json")
      .header("model", model)
      .header("Accept", "audio/mpeg, audio/*, application/octet-stream")
      .post(jsonBody.toRequestBody("application/json; charset=utf-8".toMediaType()))
      .build()
    Log.i(TAG, "Fish TTS start model=$model chars=${jsonBody.length}")
    client.newCall(req).execute().use { res ->
      val body = res.body ?: throw IllegalStateException("Fish TTS empty body.")
      val contentType = body.contentType()?.toString().orEmpty()
      val bytes = body.bytes()
      if (!res.isSuccessful) {
        val err = bytes.decodeToString().take(220)
        throw IllegalStateException("Fish TTS HTTP ${res.code}: $err")
      }
      if (contentType.contains("application/json")) {
        throw IllegalStateException(
          "Fish TTS returned JSON: ${bytes.decodeToString().take(220)}",
        )
      }
      if (bytes.size < 80) {
        throw IllegalStateException("Fish TTS audio too small (${bytes.size} bytes).")
      }
      val out = File(context.cacheDir, "stero-fish-tts.mp3")
      out.writeBytes(bytes)
      Log.i(TAG, "Fish TTS ok bytes=${bytes.size}")
      return out.absolutePath
    }
  }
}
