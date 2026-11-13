import { useProfilesStore } from '../profiles/profilesStore';
import { useSettingsStore } from '../settings/settingsStore';
import { createSessionId } from '../webhook/sessionId';
import { sendTranscript } from '../webhook/HermesWebhookClient';
import { acknowledge } from './inboxRepository';
import { postDeliveryAck } from './deliveryAck';

/**
 * Ask Hermes about a specific inbox notification (includes context.notification_id).
 */
export async function sendNotificationFollowUp(
  notificationId: string,
  text: string,
): Promise<{ responseText: string }> {
  const profile = useProfilesStore.getState().getActiveProfile();
  const mode = useSettingsStore.getState().settings.assistant.defaultMode;
  const result = await sendTranscript(profile, text, {
    sessionId: createSessionId(),
    mode,
    allowHttp: __DEV__,
    context: { notification_id: notificationId },
  });

  await acknowledge(notificationId);
  void postDeliveryAck(notificationId, 'acked');

  return { responseText: result.responseText };
}
