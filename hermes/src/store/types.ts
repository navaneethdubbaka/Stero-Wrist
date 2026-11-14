export type DeviceRecord = { device_token: string; platform: 'android' | 'ios'; app: 'stero-wrist'; profile_id: string; created_at: string; updated_at: string };
export type NotificationRecord = { notification_id: string; title: string; message: string; detail: string | null; priority: 'critical' | 'high' | 'normal' | 'low'; speak: boolean; source: string | null; dedupe_key: string | null; created_at: string };
export type AckRecord = { notification_id: string; event: string; timestamp: string; received_at: string };
export interface Store {
  upsertDevice(device: Omit<DeviceRecord, 'created_at' | 'updated_at'>): void;
  listDevices(): DeviceRecord[];
  saveNotification(notification: Omit<NotificationRecord, 'created_at'>): void;
  getNotification(id: string): NotificationRecord | undefined;
  recordAck(ack: AckRecord): void;
  close(): void;
}
