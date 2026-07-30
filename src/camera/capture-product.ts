import { type RefObject } from 'react';
import { type CameraView } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { captureProductWithGlasses } from './capture-glasses';
import { PRODUCT_IMAGE_JPEG_QUALITY, productImageResize } from './image-policy';

export type CaptureSource = 'phone' | 'm02';

export async function captureProduct(
  source: CaptureSource,
  cameraRef: RefObject<CameraView | null>,
  cameraReady: boolean,
) {
  if (source === 'm02') {
    const glassesPhoto = await captureProductWithGlasses();
    return glassesPhoto.base64;
  }

  if (!cameraRef.current || !cameraReady) {
    throw new Error('The phone camera is not ready yet.');
  }

  const photo = await cameraRef.current.takePictureAsync({
    shutterSound: false,
  });
  if (photo.width <= 0 || photo.height <= 0) {
    throw new Error('The phone product photo dimensions are invalid.');
  }
  const resize = productImageResize(photo.width, photo.height);
  const context = ImageManipulator.manipulate(photo.uri);
  context.resize(resize);
  const image = await context.renderAsync();
  const result = await image.saveAsync({
    base64: true,
    compress: PRODUCT_IMAGE_JPEG_QUALITY,
    format: SaveFormat.JPEG,
  });

  if (!result.base64) {
    throw new Error('The phone product photo could not be processed.');
  }
  return result.base64;
}
