import { NativeModule, requireNativeModule } from 'expo';

import {
  type AudioRoute,
  type AudioRouteStatus,
  type GlassesStatus,
  type GlassesThumbnailPhoto,
  type PinchGlassesModuleEvents,
} from './PinchGlasses.types';

declare class PinchGlassesModule extends NativeModule<PinchGlassesModuleEvents> {
  getStatusAsync(): Promise<GlassesStatus>;
  connectAsync(): Promise<GlassesStatus>;
  disconnectAsync(): Promise<GlassesStatus>;
  captureThumbnailAsync(qualityLevel: number): Promise<GlassesThumbnailPhoto>;
  setAudioRouteAsync(route: AudioRoute): Promise<AudioRouteStatus>;
  clearAudioRouteAsync(): Promise<AudioRouteStatus>;
}

export default requireNativeModule<PinchGlassesModule>('PinchGlasses');
