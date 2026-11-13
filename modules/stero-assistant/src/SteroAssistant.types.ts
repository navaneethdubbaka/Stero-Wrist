export type InputRouteKind = 'watch_hfp' | 'phone' | 'unknown';

export type ActiveInputInfo = {
  label: string;
  kind: InputRouteKind;
  scoOn: boolean;
  hfpAvailable: boolean;
};

export type AssistantActivatePayload = {
  source: 'watch' | 'system' | 'pending';
};

export type SteroAssistantModuleEvents = {
  assistantActivate: (payload: AssistantActivatePayload) => void;
};
