import { type Permission, PermissionsAndroid, Platform } from 'react-native';

import PinchGlasses, {
  type AudioRoute,
  type GlassesStatus,
  type GlassesStatusEvent,
} from '../../modules/pinch-glasses';

export type { GlassesStatus, GlassesStatusEvent };

export const M02_PRODUCT_QUALITY_LEVEL = 3;

export async function requestGlassesPermissions() {
  if (Platform.OS !== 'android') {
    return false;
  }

  const apiLevel = Number(Platform.Version);
  const permissions: Permission[] = [];
  if (apiLevel >= 31) {
    permissions.push(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    );
  }

  if (permissions.length === 0) {
    return true;
  }

  for (const permission of permissions) {
    if (await PermissionsAndroid.check(permission)) {
      continue;
    }
    const result = await PermissionsAndroid.request(permission);
    if (result !== PermissionsAndroid.RESULTS.GRANTED) {
      return false;
    }
  }
  return true;
}

export function getGlassesStatus(): Promise<GlassesStatus> {
  return PinchGlasses.getStatusAsync();
}

export function connectGlasses(): Promise<GlassesStatus> {
  return PinchGlasses.connectAsync();
}

export function disconnectGlasses(): Promise<GlassesStatus> {
  return PinchGlasses.disconnectAsync();
}

export function subscribeToGlassesStatus(
  listener: (event: GlassesStatusEvent) => void,
) {
  return PinchGlasses.addListener('onStatusChanged', listener);
}

export function selectCommunicationAudioRoute(route: AudioRoute) {
  return PinchGlasses.setAudioRouteAsync(route);
}

export function clearCommunicationAudioRoute() {
  return PinchGlasses.clearAudioRouteAsync();
}

export async function captureProductWithGlasses() {
  if (Platform.OS !== 'android') {
    throw new Error('M02 glasses capture is only available on Android.');
  }
  const result = await PinchGlasses.captureThumbnailAsync(
    M02_PRODUCT_QUALITY_LEVEL,
  );
  if (!result.base64) {
    throw new Error('The M02 returned a product photo without JPEG data.');
  }
  console.info('[capture] M02 product photo ready.', {
    qualityLevel: result.qualityLevel,
    width: result.width,
    height: result.height,
    byteCount: result.byteCount,
    packetCount: result.packetCount,
    negotiatedMtu: result.negotiatedMtu,
    highPriorityRequested: result.highPriorityRequested,
    packetIntervalAverageMs: result.packetIntervalAverageMs,
    packetIntervalP95Ms: result.packetIntervalP95Ms,
    packetIntervalMaxMs: result.packetIntervalMaxMs,
    connectionMs: result.connectionMs,
    shutterMs: result.shutterMs,
    firstChunkMs: result.firstChunkMs,
    transferMs: result.transferMs,
    totalMs: result.totalMs,
  });
  return result;
}
