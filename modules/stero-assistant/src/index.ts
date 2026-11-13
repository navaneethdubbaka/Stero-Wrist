import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type {
  ActiveInputInfo,
  AssistantActivatePayload,
  SteroAssistantModuleEvents,
} from './SteroAssistant.types';

export type {
  ActiveInputInfo,
  AssistantActivatePayload,
  InputRouteKind,
  SteroAssistantModuleEvents,
} from './SteroAssistant.types';

type EventSub = { remove: () => void };

type NativeSteroAssistant = {
  isDefaultAssistant(): Promise<boolean>;
  openAssistantSettings(): Promise<void>;
  startInputRoute(preferWatch: boolean): Promise<ActiveInputInfo>;
  stopInputRoute(): Promise<void>;
  getActiveInputInfo(): Promise<ActiveInputInfo>;
  consumePendingActivation(): Promise<AssistantActivatePayload | null>;
  startMicForegroundService(): Promise<void>;
  stopMicForegroundService(): Promise<void>;
  addListener<EventName extends keyof SteroAssistantModuleEvents>(
    eventName: EventName,
    listener: SteroAssistantModuleEvents[EventName],
  ): EventSub;
};

const Native =
  requireOptionalNativeModule<NativeSteroAssistant>('SteroAssistant');

const FALLBACK_INPUT: ActiveInputInfo = {
  label: 'Phone mic',
  kind: 'phone',
  scoOn: false,
  hfpAvailable: false,
};

export function isSteroAssistantAvailable(): boolean {
  return Native != null && Platform.OS === 'android';
}

export async function isDefaultAssistant(): Promise<boolean> {
  if (!Native) return false;
  return Native.isDefaultAssistant();
}

export async function openAssistantSettings(): Promise<void> {
  if (!Native) return;
  await Native.openAssistantSettings();
}

export async function startInputRoute(
  preferWatch: boolean,
): Promise<ActiveInputInfo> {
  if (!Native) return FALLBACK_INPUT;
  return Native.startInputRoute(preferWatch);
}

export async function stopInputRoute(): Promise<void> {
  if (!Native) return;
  await Native.stopInputRoute();
}

export async function getActiveInputInfo(): Promise<ActiveInputInfo> {
  if (!Native) return FALLBACK_INPUT;
  return Native.getActiveInputInfo();
}

export async function consumePendingActivation(): Promise<AssistantActivatePayload | null> {
  if (!Native) return null;
  return Native.consumePendingActivation();
}

export async function startMicForegroundService(): Promise<void> {
  if (!Native) return;
  await Native.startMicForegroundService();
}

export async function stopMicForegroundService(): Promise<void> {
  if (!Native) return;
  await Native.stopMicForegroundService();
}

export function addAssistantActivateListener(
  listener: (payload: AssistantActivatePayload) => void,
): { remove: () => void } {
  if (!Native) {
    return { remove: () => undefined };
  }
  return Native.addListener('assistantActivate', listener);
}
