import { describe, expect, it } from 'vitest';

import {
  PRODUCT_IMAGE_JPEG_QUALITY,
  PRODUCT_IMAGE_LONG_SIDE,
  productImageResize,
} from '../../src/camera/image-policy';

describe('product image policy', () => {
  it('resizes landscape and portrait photos to a 1024px long side', () => {
    expect(productImageResize(4032, 3024)).toEqual({ width: 1024 });
    expect(productImageResize(3024, 4032)).toEqual({ height: 1024 });
    expect(PRODUCT_IMAGE_LONG_SIDE).toBe(1024);
  });

  it('uses the single required JPEG quality', () => {
    expect(PRODUCT_IMAGE_JPEG_QUALITY).toBe(0.7);
  });
});
