import { useProfilesStore } from '../profiles/profilesStore';
import { useSettingsStore } from '../settings/settingsStore';
import { secretGet } from '../../shared/storage/secrets';
import {
  assertWebhookUrlAllowed,
  buildWebhookHeaders,
} from '../webhook/requestBuilder';
import type { DeliveryStatus } from './inboxTypes';

/**
 * Optional fire-and-forget delivery acknowledgement to Hermes.
 */
export async function postDeliveryAck(
  notificationId: string,
  event: DeliveryStatus,
): Promise<void> {
  const ackUrl = useSettingsStore.getState().settings.notifications.ackUrl?.trim();
  if (!ackUrl) return;

  const profile = useProfilesStore.getState().getActiveProfile();
  if (!profile) return;

  try {
    assertWebhookUrlAllowed(ackUrl, __DEV__);
    const token = profile.webhook.tokenSecretId
      ? await secretGet(profile.webhook.tokenSecretId)
      : null;
    const headers = buildWebhookHeaders(profile.webhook, token);
    await fetch(ackUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        notification_id: notificationId,
        event,
        timestamp: new Date().toISOString(),
        app: 'stero-wrist',
      }),
    });
  } catch {
    // Best-effort; never block inbox/speech.
  }
}
