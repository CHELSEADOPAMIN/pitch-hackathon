import { type RefObject } from 'react';
import { type CameraView } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { captureProductWithGlasses } from './capture-glasses';
import { PRODUCT_IMAGE_JPEG_QUALITY, productImageResize } from './image-policy';

export async function captureProduct(
  cameraRef: RefObject<CameraView | null>,
  ready: boolean,
) {
  const glassesPhoto = await captureProductWithGlasses();
  if (glassesPhoto) {
    return processProductImage(
      glassesPhoto.uri,
      glassesPhoto.width,
      glassesPhoto.height,
    );
  }

  if (!cameraRef.current || !ready) {
    throw new Error('The camera is not ready yet.');
  }

  const photo = await cameraRef.current.takePictureAsync({
    shutterSound: false,
  });
  return processProductImage(photo.uri, photo.width, photo.height);
}

async function processProductImage(uri: string, width: number, height: number) {
  if (width <= 0 || height <= 0) {
    throw new Error('The product photo dimensions are invalid.');
  }
  const resize = productImageResize(width, height);
  const context = ImageManipulator.manipulate(uri);
  context.resize(resize);
  const image = await context.renderAsync();
  const result = await image.saveAsync({
    base64: true,
    compress: PRODUCT_IMAGE_JPEG_QUALITY,
    format: SaveFormat.JPEG,
  });

  if (!result.base64) {
    throw new Error('The product photo could not be processed.');
  }
  return result.base64;
}
