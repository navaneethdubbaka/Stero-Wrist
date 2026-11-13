package expo.modules.steroassistant

import android.os.Bundle
import android.service.voice.VoiceInteractionSession
import android.service.voice.VoiceInteractionSessionService

class SteroVoiceInteractionSessionService : VoiceInteractionSessionService() {
  override fun onNewSession(args: Bundle?): VoiceInteractionSession {
    return SteroVoiceInteractionSession(this)
  }
}
