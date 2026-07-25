import { type RefObject } from 'react';
import { type CameraView } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { PRODUCT_IMAGE_JPEG_QUALITY, productImageResize } from './image-policy';

export async function captureProduct(
  cameraRef: RefObject<CameraView | null>,
  ready: boolean,
) {
  if (!cameraRef.current || !ready) {
    throw new Error('相机尚未就绪');
  }

  const photo = await cameraRef.current.takePictureAsync({
    shutterSound: false,
  });
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
    throw new Error('照片处理失败');
  }
  return result.base64;
}
