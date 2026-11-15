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
 * In-call "answered" UI while the watch HFP session is live.
 */
class SteroOrbView(
  context: Context,
  private val onClose: () -> Unit,
) : FrameLayout(context) {

  private val status: TextView
  private val timer: Chronometer
  private var phase: String = "listening"

  init {
    setBackgroundColor(0xF2101018.toInt())
    isClickable = true
    isFocusable = true

    val density = resources.displayMetrics.density
    fun dp(v: Int) = (v * density).toInt()

    val column = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      layoutParams = LayoutParams(
        LayoutParams.MATCH_PARENT,
        LayoutParams.WRAP_CONTENT,
        Gravity.CENTER,
      )
    }

    val title = TextView(context).apply {
      text = "Stero"
      setTextColor(Color.WHITE)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 28f)
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
    }

    val answered = TextView(context).apply {
      text = "Call answered"
      setTextColor(0xFF8BC34A.toInt())
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
      gravity = Gravity.CENTER
      setPadding(0, dp(10), 0, 0)
    }

    timer = Chronometer(context).apply {
      setTextColor(0xCCFFFFFF.toInt())
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
      gravity = Gravity.CENTER
      setPadding(0, dp(8), 0, 0)
      base = SystemClock.elapsedRealtime()
      start()
    }

    status = TextView(context).apply {
      text = "Listening on watch…"
      setTextColor(0x99FFFFFF.toInt())
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
      gravity = Gravity.CENTER
      setPadding(0, dp(16), 0, 0)
    }

    val hangup = TextView(context).apply {
      layoutParams = LinearLayout.LayoutParams(dp(72), dp(72)).apply {
        gravity = Gravity.CENTER_HORIZONTAL
        topMargin = dp(48)
      }
      text = "⏻"
      gravity = Gravity.CENTER
      setTextColor(Color.WHITE)
      textSize = 28f
      contentDescription = "Hang up"
      isClickable = true
      isFocusable = true
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(0xFFE53935.toInt())
      }
      setOnClickListener { onClose() }
    }

    val hangLabel = TextView(context).apply {
      text = "Hang up"
      setTextColor(0xCCFFFFFF.toInt())
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
      gravity = Gravity.CENTER
      setPadding(0, dp(10), 0, 0)
    }

    column.addView(title)
    column.addView(answered)
    column.addView(timer)
    column.addView(status)
    column.addView(hangup)
    column.addView(hangLabel)
    addView(column)

    setPhase("listening")
  }

  fun setPhase(next: String) {
    phase = next
    status.text = when (next) {
      "listening" -> "Listening on watch…"
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
