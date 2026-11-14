import type { DeviceRecord } from '../store/types.ts';
export type HermesPushPayload = { type: 'hermes_notification'; notification_id: string; title: string; message: string; presentation_priority: 'critical' | 'high' | 'normal' | 'low'; speak: boolean; timestamp: string; source: string; dedupe_key?: string };
export interface PushSender { readonly name: string; send(device: DeviceRecord, payload: HermesPushPayload): Promise<void>; }
