import { registerWebModule, NativeModule } from 'expo';

import {
  type GlassesLiveProbe,
  type GlassesPhoto,
  type GlassesStatus,
  type GlassesThumbnailPhoto,
  type PinchGlassesModuleEvents,
} from './PinchGlasses.types';

// PinchGlassesModule is not available on the web platform.
class PinchGlassesModule extends NativeModule<PinchGlassesModuleEvents> {
  async getStatusAsync(): Promise<GlassesStatus> {
    return {
      available: false,
      bonded: false,
      permissionGranted: false,
    };
  }

  async capturePhotoAsync(): Promise<GlassesPhoto> {
    throw new Error('M02 glasses capture is only available on Android.');
  }

  async captureThumbnailAsync(
    _qualityLevel: number,
  ): Promise<GlassesThumbnailPhoto> {
    throw new Error(
      'M02 glasses thumbnail capture is only available on Android.',
    );
  }

  async probeLivePreviewAsync(): Promise<GlassesLiveProbe> {
    throw new Error('M02 glasses Live probing is only available on Android.');
  }
}

export default registerWebModule(PinchGlassesModule, 'PinchGlassesModule');
