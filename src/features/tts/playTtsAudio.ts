import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioResult } from './TtsProvider';

let activePlayer: ReturnType<typeof createAudioPlayer> | null = null;

export async function stopTtsAudioPlayback(): Promise<void> {
  try {
    activePlayer?.pause();
    activePlayer?.remove();
  } catch {
    // ignore
  }
  activePlayer = null;
}

/**
 * Play cloud TTS file/stream results. System kind is a no-op (already spoken).
 */
export async function playTtsAudio(result: AudioResult): Promise<void> {
  if (result.kind === 'system' || !result.uri) {
    return;
  }

  await stopTtsAudioPlayback();

  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
    });
  } catch {
    // Mode may fail on some platforms; still try playback.
  }

  const player = createAudioPlayer(result.uri, { downloadFirst: true });
  activePlayer = player;

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        sub.remove();
      } catch {
        // ignore
      }
      try {
        player.remove();
      } catch {
        // ignore
      }
      if (activePlayer === player) activePlayer = null;
      resolve();
    };

    let sub: { remove: () => void };
    try {
      sub = player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          finish();
        }
      });
      player.play();
      // Safety: if didJustFinish never fires, release after duration + buffer.
      const ms =
        typeof result.durationMs === 'number' && result.durationMs > 0
          ? result.durationMs + 1500
          : 120_000;
      setTimeout(finish, ms);
    } catch (error) {
      settled = true;
      if (activePlayer === player) activePlayer = null;
      reject(
        error instanceof Error ? error : new Error('TTS audio playback failed.'),
      );
    }
  });
}
