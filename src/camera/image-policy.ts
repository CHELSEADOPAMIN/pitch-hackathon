export const PRODUCT_IMAGE_LONG_SIDE = 1024;
export const PRODUCT_IMAGE_JPEG_QUALITY = 0.7;

export function productImageResize(width: number, height: number) {
  return width >= height
    ? { width: PRODUCT_IMAGE_LONG_SIDE }
    : { height: PRODUCT_IMAGE_LONG_SIDE };
}
