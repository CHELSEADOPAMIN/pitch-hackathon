import { NativeModule, requireNativeModule } from 'expo';

import {
  type AudioRoute,
  type AudioRouteStatus,
  type GlassesRealtimePreparation,
  type GlassesStatus,
  type GlassesThumbnailPhoto,
  type PinchGlassesModuleEvents,
} from './PinchGlasses.types';

declare class PinchGlassesModule extends NativeModule<PinchGlassesModuleEvents> {
  getStatusAsync(): Promise<GlassesStatus>;
  connectAsync(): Promise<GlassesStatus>;
  disconnectAsync(): Promise<GlassesStatus>;
  prepareForRealtimeAsync(): Promise<GlassesRealtimePreparation>;
  captureThumbnailAsync(qualityLevel: number): Promise<GlassesThumbnailPhoto>;
  logTrace(message: string): void;
  setAudioRouteAsync(route: AudioRoute): Promise<AudioRouteStatus>;
  clearAudioRouteAsync(): Promise<AudioRouteStatus>;
}

export default requireNativeModule<PinchGlassesModule>('PinchGlasses');
