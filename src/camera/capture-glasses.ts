import { type Permission, PermissionsAndroid, Platform } from 'react-native';

import PinchGlasses, {
  type GlassesLiveProbe,
  type GlassesThumbnailPhoto,
} from '../../modules/pinch-glasses';

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
  if (apiLevel >= 33) {
    permissions.push(PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES);
  } else {
    permissions.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  }

  const results = await PermissionsAndroid.requestMultiple(permissions);
  return permissions.every(
    (permission) => results[permission] === PermissionsAndroid.RESULTS.GRANTED,
  );
}

export async function captureProductWithGlasses() {
  if (Platform.OS !== 'android') {
    return null;
  }
  const status = await PinchGlasses.getStatusAsync();
  if (!status.available) {
    return null;
  }
  return PinchGlasses.capturePhotoAsync();
}

export async function probeGlassesLivePreview(): Promise<GlassesLiveProbe> {
  if (Platform.OS !== 'android') {
    throw new Error('M02 glasses Live probing is only available on Android.');
  }
  return PinchGlasses.probeLivePreviewAsync();
}

export async function captureGlassesThumbnail(
  qualityLevel: number,
): Promise<GlassesThumbnailPhoto> {
  if (Platform.OS !== 'android') {
    throw new Error(
      'M02 glasses thumbnail capture is only available on Android.',
    );
  }
  return PinchGlasses.captureThumbnailAsync(qualityLevel);
}
