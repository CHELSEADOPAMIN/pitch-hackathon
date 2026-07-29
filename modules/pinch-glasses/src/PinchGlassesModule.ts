import { NativeModule, requireNativeModule } from 'expo';

import {
  type GlassesLiveProbe,
  type GlassesPhoto,
  type GlassesStatus,
  type GlassesThumbnailPhoto,
  type PinchGlassesModuleEvents,
} from './PinchGlasses.types';

declare class PinchGlassesModule extends NativeModule<PinchGlassesModuleEvents> {
  getStatusAsync(): Promise<GlassesStatus>;
  capturePhotoAsync(): Promise<GlassesPhoto>;
  captureThumbnailAsync(qualityLevel: number): Promise<GlassesThumbnailPhoto>;
  probeLivePreviewAsync(): Promise<GlassesLiveProbe>;
}

export default requireNativeModule<PinchGlassesModule>('PinchGlasses');
