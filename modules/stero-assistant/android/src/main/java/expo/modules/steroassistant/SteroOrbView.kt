package expo.modules.steroassistant

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.SystemClock
import android.util.TypedValue
import android.view.Gravity
import android.widget.Chronometer
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Light in-call chrome on the phone. The watch native call face is the real UI.
 */
class SteroOrbView(
  context: Context,
  private val onClose: () -> Unit,
) : FrameLayout(context) {

  private val status: TextView
  private val timer: Chronometer
  private var phase: String = "listening"

  init {
    setBackgroundColor(0x66000000)
    isClickable = true
    isFocusable = true

    val density = resources.displayMetrics.density
    fun dp(v: Int) = (v * density).toInt()

    val card = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      background = GradientDrawable().apply {
        cornerRadius = dp(24).toFloat()
        setColor(0xF21A1A22.toInt())
      }
      setPadding(dp(28), dp(28), dp(28), dp(24))
      layoutParams = LayoutParams(
        LayoutParams.WRAP_CONTENT,
        LayoutParams.WRAP_CONTENT,
        Gravity.CENTER,
      )
    }

    val title = TextView(context).apply {
      text = SteroCallSession.CALL_NAME
      setTextColor(Color.WHITE)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 26f)
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
    }

    val number = TextView(context).apply {
      text = SteroCallSession.CALL_NUMBER
      setTextColor(0xCCFFFFFF.toInt())
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
      gravity = Gravity.CENTER
      setPadding(0, dp(4), 0, 0)
    }

    val answered = TextView(context).apply {
      text = "Call answered"
      setTextColor(0xFF8BC34A.toInt())
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
      gravity = Gravity.CENTER
      setPadding(0, dp(8), 0, 0)
    }

    timer = Chronometer(context).apply {
      setTextColor(0xCCFFFFFF.toInt())
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
      gravity = Gravity.CENTER
      setPadding(0, dp(6), 0, 0)
      base = SystemClock.elapsedRealtime()
      start()
    }

    status = TextView(context).apply {
      text = "Listening on watch…"
      setTextColor(0x99FFFFFF.toInt())
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
      gravity = Gravity.CENTER
      setPadding(0, dp(12), 0, 0)
    }

    val hangup = TextView(context).apply {
      layoutParams = LinearLayout.LayoutParams(dp(64), dp(64)).apply {
        gravity = Gravity.CENTER_HORIZONTAL
        topMargin = dp(28)
      }
      text = "⏻"
      gravity = Gravity.CENTER
      setTextColor(Color.WHITE)
      textSize = 26f
      contentDescription = "Hang up"
      isClickable = true
      isFocusable = true
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(0xFFE53935.toInt())
      }
      setOnClickListener { onClose() }
    }

    card.addView(title)
    card.addView(number)
    card.addView(answered)
    card.addView(timer)
    card.addView(status)
    card.addView(hangup)
    addView(card)

    setPhase("listening")
  }

  fun setPhase(next: String) {
    phase = next
    status.text = when (next) {
      "listening" -> "Listening on watch…"
      "transcribing" -> "Transcribing…"
      "transcribed" -> "Transcribed"
      "sending" -> "Sending to Hermes…"
      "thinking" -> "Thinking…"
      "speaking" -> "Speaking…"
      "error" -> "Call ended"
      "idle" -> "Call ended"
      else -> next
    }
  }

  override fun onDetachedFromWindow() {
    try {
      timer.stop()
    } catch (_: Exception) {
      // ignore
    }
    super.onDetachedFromWindow()
  }
}
