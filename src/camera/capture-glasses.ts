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
  const results = await PermissionsAndroid.requestMultiple(permissions);
  return permissions.every(
    (permission) => results[permission] === PermissionsAndroid.RESULTS.GRANTED,
  );
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
  return result;
}
