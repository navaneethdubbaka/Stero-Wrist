import { Platform } from 'react-native';
import type { BackendProfile } from '../../shared/types/settings';
import { secretGet } from '../../shared/storage/secrets';
import {
  assertWebhookUrlAllowed,
  buildWebhookHeaders,
} from '../webhook/requestBuilder';
import { classifyHttpStatus, WebhookError } from '../webhook/errors';
import type { DeviceTokenRegistrationBody } from './types';

export function buildDeviceTokenBody(
  deviceToken: string,
  profileId: string,
  platform: 'android' | 'ios' = Platform.OS === 'ios' ? 'ios' : 'android',
): DeviceTokenRegistrationBody {
  return {
    device_token: deviceToken,
    platform,
    app: 'stero-wrist',
    profile_id: profileId,
  };
}

/**
 * POST device token to Hermes. Separate from voice webhook client.
 */
export async function registerDeviceToken(options: {
  deviceTokenUrl: string;
  profile: BackendProfile | null;
  deviceToken: string;
  allowHttp: boolean;
}): Promise<void> {
  const url = options.deviceTokenUrl.trim();
  if (!url) {
    throw new WebhookError(
      'no_profile',
      'Device token URL is empty. Set it in Notification settings.',
    );
  }
  if (!options.profile) {
    throw new WebhookError(
      'no_profile',
      'Select an active backend profile to register the device token.',
    );
  }

  assertWebhookUrlAllowed(url, options.allowHttp);

  const token = options.profile.webhook.tokenSecretId
    ? await secretGet(options.profile.webhook.tokenSecretId)
    : null;

  const headers = buildWebhookHeaders(options.profile.webhook, token);
  const body = buildDeviceTokenBody(options.deviceToken, options.profile.id);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new WebhookError(
        classifyHttpStatus(response.status),
        `Device token registration failed (${response.status}).`,
        response.status,
      );
    }
  } catch (error) {
    if (error instanceof WebhookError) throw error;
    if (
      error instanceof Error &&
      (error.name === 'AbortError' || error.message.includes('Aborted'))
    ) {
      throw new WebhookError('timeout', 'Device token registration timed out.');
    }
    throw new WebhookError(
      'network',
      error instanceof Error
        ? error.message
        : 'Device token registration network error.',
    );
  } finally {
    clearTimeout(timer);
  }
}
