import type { DeviceRecord } from '../store/types.ts';
import type { HermesPushPayload, PushSender } from './types.ts';
export class NoopPushSender implements PushSender {
  readonly name = 'noop';
  readonly sent: Array<{ device: DeviceRecord; payload: HermesPushPayload }> = [];
  async send(device: DeviceRecord, payload: HermesPushPayload): Promise<void> { this.sent.push({ device, payload }); console.info('Noop push delivery', { device_token: device.device_token, payload }); }
}
