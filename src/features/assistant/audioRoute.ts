import {
  getActiveInputInfo as nativeGetActiveInputInfo,
  isSteroAssistantAvailable,
  startInputRoute as nativeStartInputRoute,
  startMicForegroundService,
  stopInputRoute as nativeStopInputRoute,
  stopMicForegroundService,
  type ActiveInputInfo,
} from '../../../modules/stero-assistant/src';
import type { AudioInputPreference } from '../../shared/types/settings';
import {
  decideInputRoute,
  type ActiveInputInfoLike,
} from './audioRoutePolicy';

export type { ActiveInputInfo };

const PHONE_FALLBACK: ActiveInputInfo = {
  label: 'Phone mic',
  kind: 'phone',
  scoOn: false,
  hfpAvailable: false,
};

/**
 * Prefer watch HFP when settings + hardware allow; always return probed info.
 */
export async function preferWatchMic(
  preference: AudioInputPreference,
): Promise<{
  info: ActiveInputInfoLike;
  banner: string | null;
  usingPhoneFallback: boolean;
}> {
  let probe: ActiveInputInfo = PHONE_FALLBACK;
  try {
    probe = await nativeGetActiveInputInfo();
  } catch {
    probe = PHONE_FALLBACK;
  }

  const decision = decideInputRoute(preference, probe.hfpAvailable);

  let info: ActiveInputInfo = probe;
  try {
    info = await nativeStartInputRoute(decision.preferWatch);
  } catch {
    info = PHONE_FALLBACK;
  }

  const scoFailed = decision.preferWatch && info.kind !== 'watch_hfp';
  const usingPhoneFallback = decision.usingPhoneFallback || scoFailed;
  const banner =
    decision.banner ?? (scoFailed ? 'Using phone mic' : null);

  if (isSteroAssistantAvailable()) {
    try {
      await startMicForegroundService();
    } catch {
      // Non-fatal on devices that block FGS.
    }
  }

  return { info, banner, usingPhoneFallback };
}

export async function stopScoAndMicService(): Promise<void> {
  try {
    await nativeStopInputRoute();
  } catch {
    // ignore
  }
  try {
    await stopMicForegroundService();
  } catch {
    // ignore
  }
}

export async function readActiveInputInfo(): Promise<ActiveInputInfo> {
  try {
    return await nativeGetActiveInputInfo();
  } catch {
    return PHONE_FALLBACK;
  }
}
