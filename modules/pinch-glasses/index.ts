// Re-export the native module. On web, it will be resolved to PinchGlassesModule.web.ts
// and on native platforms to PinchGlassesModule.ts
export { default } from './src/PinchGlassesModule';
export * from './src/PinchGlasses.types';
