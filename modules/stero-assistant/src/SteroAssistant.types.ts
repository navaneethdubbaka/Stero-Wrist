export type InputRouteKind = 'watch_hfp' | 'phone' | 'unknown';

export type ActiveInputInfo = {
  label: string;
  kind: InputRouteKind;
  scoOn: boolean;
  hfpAvailable: boolean;
};

export type AssistantActivatePayload = {
  source: string;
};

export type OverlayPhase =
  | 'listening'
  | 'transcribing'
  | 'transcribed'
  | 'sending'
  | 'thinking'
  | 'speaking'
  | 'idle'
  | 'error';

export type SteroAssistantModuleEvents = {
  assistantActivate: (payload: AssistantActivatePayload) => void;
  assistantOverlayCancel: (payload: Record<string, never>) => void;
};
