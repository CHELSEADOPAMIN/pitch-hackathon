export type PinchGlassesModuleEvents = {
  onStatusChanged: (params: GlassesStatusEvent) => void;
};

export type GlassesStatusEvent = {
  stage:
    | 'connecting'
    | 'ready'
    | 'capturing'
    | 'transferring'
    | 'disconnected'
    | 'error';
  detail?: string;
};

export type GlassesStatus = {
  available: boolean;
  permissionGranted: boolean;
  bonded: boolean;
  connected: boolean;
  deviceName?: string;
  deviceAddress?: string;
  negotiatedMtu?: number;
  sessionAgeMs?: number;
  connectionMs?: number;
};

export type GlassesThumbnailPhoto = {
  uri: string;
  base64: string;
  width: number;
  height: number;
  fileName: string;
  deviceName: string;
  qualityLevel: number;
  qualityName: string;
  byteCount: number;
  packetCount: number;
  negotiatedMtu: number;
  highPriorityRequested: boolean;
  highPriorityRefreshRequested?: boolean;
  firstSlowChunkMs?: number;
  packetIntervalAverageMs?: number;
  packetIntervalP95Ms?: number;
  packetIntervalMaxMs?: number;
  connectionMs: number;
  shutterMs: number;
  firstChunkMs: number;
  transferMs: number;
  totalMs: number;
  commandError?: number;
  commandWorkType?: number;
  commandResponseHex?: string;
};

export type GlassesRealtimePreparation = {
  highPriorityRequested: boolean;
  negotiatedMtu: number;
  warmupMs: number;
};

export type AudioRoute = 'phone' | 'm02';

export type AudioRouteStatus = {
  requestedRoute?: AudioRoute;
  selected: boolean;
  deviceName?: string;
  deviceType?: number;
  confirmationMs?: number;
};
