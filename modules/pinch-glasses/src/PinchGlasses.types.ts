export type PinchGlassesModuleEvents = {
  onStatusChanged: (params: GlassesStatusEvent) => void;
};

export type GlassesStatusEvent = {
  stage:
    | 'connecting'
    | 'capturing'
    | 'capturing-thumbnail'
    | 'transferring'
    | 'downloading'
    | 'downloading-thumbnail'
    | 'ready'
    | 'thumbnail-ready'
    | 'probing-capability'
    | 'starting-live'
    | 'connecting-p2p'
    | 'probing-rtsp'
    | 'live-reachable'
    | 'stopping-live'
    | 'live-unsupported';
  detail?: string;
};

export type GlassesStatus = {
  available: boolean;
  permissionGranted: boolean;
  bonded: boolean;
  deviceName?: string;
  deviceAddress?: string;
};

export type GlassesPhoto = {
  uri: string;
  width: number;
  height: number;
  fileName: string;
  deviceName: string;
};

export type GlassesThumbnailPhoto = GlassesPhoto & {
  qualityLevel: number;
  qualityName: string;
  byteCount: number;
  packetCount: number;
  negotiatedMtu: number;
  connectionMs: number;
  shutterMs: number;
  firstChunkMs: number;
  transferMs: number;
  totalMs: number;
  commandError?: number;
  commandWorkType?: number;
  commandResponseHex?: string;
};

export type GlassesLiveProbe = {
  deviceName: string;
  advertisedSupport?: boolean;
  capabilityReceived: boolean;
  capabilityRawHex?: string;
  startAcknowledged?: boolean;
  startErrorCode?: number;
  liveNotificationType?: number;
  glassesIp?: string;
  p2pConnected: boolean;
  tcpConnected: boolean;
  rtspReachable: boolean;
  rtspStatusLine?: string;
  ipNotificationMs?: number;
  rtspReadyMs?: number;
  totalMs: number;
  error?: string;
};
