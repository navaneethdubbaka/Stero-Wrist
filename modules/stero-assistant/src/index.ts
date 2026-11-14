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

export type OutputRouteResult = {
  label: string;
  kind: string;
  applied: boolean;
};

export type AssistantStatus = {
  roleHeld: boolean;
  voiceInteractionService: string;
  assistComponent: string;
  ourComponent: string;
  isSelected: boolean;
  voiceSelected: boolean;
  assistSelected: boolean;
};

type NativeSteroAssistant = {
  isDefaultAssistant(): Promise<boolean>;
  getAssistantStatus(): Promise<AssistantStatus>;
  openAssistantSettings(): Promise<void>;
  applyVoiceInteractionSelection(): Promise<{
    ok: boolean;
    error?: string;
    voiceInteractionService?: string;
    assistant?: string;
  }>;
  startInputRoute(preferWatch: boolean): Promise<ActiveInputInfo>;
  stopInputRoute(): Promise<void>;
  getActiveInputInfo(): Promise<ActiveInputInfo>;
  preferOutputRoute(preference: string): Promise<OutputRouteResult>;
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

export async function getAssistantStatus(): Promise<AssistantStatus> {
  if (!Native) {
    return {
      roleHeld: false,
      voiceInteractionService: '',
      assistComponent: '',
      ourComponent: '',
      isSelected: false,
      voiceSelected: false,
      assistSelected: false,
    };
  }
  return Native.getAssistantStatus();
}

export async function openAssistantSettings(): Promise<void> {
  if (!Native) return;
  await Native.openAssistantSettings();
}

export async function applyVoiceInteractionSelection(): Promise<{
  ok: boolean;
  error?: string;
  voiceInteractionService?: string;
  assistant?: string;
}> {
  if (!Native) {
    return { ok: false, error: 'Native module unavailable' };
  }
  return Native.applyVoiceInteractionSelection();
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

export async function preferOutputRoute(
  preference: string,
): Promise<OutputRouteResult> {
  if (!Native) {
    return { label: 'Phone speaker', kind: 'phone_speaker', applied: false };
  }
  return Native.preferOutputRoute(preference);
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
