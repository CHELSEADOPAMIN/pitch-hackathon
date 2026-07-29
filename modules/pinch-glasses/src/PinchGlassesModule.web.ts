import { registerWebModule, NativeModule } from 'expo';

import {
  type AudioRoute,
  type AudioRouteStatus,
  type GlassesStatus,
  type GlassesThumbnailPhoto,
  type PinchGlassesModuleEvents,
} from './PinchGlasses.types';

class PinchGlassesModule extends NativeModule<PinchGlassesModuleEvents> {
  async getStatusAsync(): Promise<GlassesStatus> {
    return {
      available: false,
      bonded: false,
      connected: false,
      permissionGranted: false,
    };
  }

  async connectAsync(): Promise<GlassesStatus> {
    throw new Error('M02 glasses are only available on Android.');
  }

  async disconnectAsync(): Promise<GlassesStatus> {
    return this.getStatusAsync();
  }

  async captureThumbnailAsync(
    _qualityLevel: number,
  ): Promise<GlassesThumbnailPhoto> {
    throw new Error('M02 glasses capture is only available on Android.');
  }

  async setAudioRouteAsync(_route: AudioRoute): Promise<AudioRouteStatus> {
    throw new Error('Explicit audio routing is only available on Android.');
  }

  async clearAudioRouteAsync(): Promise<AudioRouteStatus> {
    return { selected: false };
  }
}

export default registerWebModule(PinchGlassesModule, 'PinchGlassesModule');
