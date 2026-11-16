package expo.modules.steroassistant

import android.util.Log
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

object GroqWhisperClient {
  private const val TAG = "SteroCall"
  private const val URL = "https://api.groq.com/openai/v1/audio/transcriptions"

  fun transcribe(
    path: String,
    apiKey: String,
    model: String,
    language: String,
  ): String {
    val file = File(path)
    if (!file.exists() || file.length() < 100) {
      throw IllegalStateException("Recording file missing or too small.")
    }
    val client = OkHttpClient.Builder()
      .connectTimeout(15, TimeUnit.SECONDS)
      .writeTimeout(30, TimeUnit.SECONDS)
      .readTimeout(30, TimeUnit.SECONDS)
      .callTimeout(40, TimeUnit.SECONDS)
      .build()
    val wav = file.asRequestBody("audio/wav".toMediaType())
    val body = MultipartBody.Builder()
      .setType(MultipartBody.FORM)
      .addFormDataPart("file", "talk.wav", wav)
      .addFormDataPart("model", model)
      .addFormDataPart("temperature", "0")
      .addFormDataPart("response_format", "verbose_json")
      .addFormDataPart("language", language)
      .build()
    val req = Request.Builder()
      .url(URL)
      .header("Authorization", "Bearer $apiKey")
      .post(body)
      .build()
    Log.i(TAG, "Groq STT start model=$model bytes=${file.length()}")
    client.newCall(req).execute().use { res ->
      val raw = res.body?.string().orEmpty()
      if (!res.isSuccessful) {
        throw IllegalStateException(
          "Groq STT HTTP ${res.code}: ${raw.take(180)}",
        )
      }
      val text = JSONObject(raw).optString("text").trim()
      if (text.isEmpty()) {
        throw IllegalStateException("Groq STT returned empty text.")
      }
      Log.i(TAG, "Groq STT ok chars=${text.length}")
      return text
    }
  }
}
