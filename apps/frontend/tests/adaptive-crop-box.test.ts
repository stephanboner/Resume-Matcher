import { describe, expect, it } from 'vitest';
import {
  moveCrop,
  resizeCrop,
  resizeSquareCrop,
  toSquareCrop,
  type CropHandle,
  type CropRect,
} from '@/components/builder/adaptive-crop-box';

const crop: CropRect = {
  cropX: 20,
  cropY: 20,
  cropWidth: 40,
  cropHeight: 30,
};

describe('adaptive crop geometry', () => {
  it('moves the complete crop rectangle and clamps it inside the image', () => {
    expect(moveCrop(crop, 15, -10)).toEqual({
      cropX: 35,
      cropY: 10,
      cropWidth: 40,
      cropHeight: 30,
    });
    expect(moveCrop(crop, 100, 100)).toEqual({
      cropX: 60,
      cropY: 70,
      cropWidth: 40,
      cropHeight: 30,
    });
  });

  it.each([
    ['w', -10, 0, { cropX: 10, cropY: 20, cropWidth: 50, cropHeight: 30 }],
    ['e', 10, 0, { cropX: 20, cropY: 20, cropWidth: 50, cropHeight: 30 }],
    ['n', 0, -10, { cropX: 20, cropY: 10, cropWidth: 40, cropHeight: 40 }],
    ['s', 0, 10, { cropX: 20, cropY: 20, cropWidth: 40, cropHeight: 40 }],
  ] satisfies Array<[CropHandle, number, number, CropRect]>)(
    'resizes only the selected %s edge',
    (handle, dx, dy, expected) => {
      expect(resizeCrop(crop, handle, dx, dy)).toEqual(expected);
    }
  );

  it.each([
    ['nw', -20, -2, { cropX: 0, cropY: 5, cropWidth: 60, cropHeight: 45 }],
    ['ne', 20, -2, { cropX: 20, cropY: 5, cropWidth: 60, cropHeight: 45 }],
    ['sw', -20, 2, { cropX: 0, cropY: 20, cropWidth: 60, cropHeight: 45 }],
    ['se', 20, 2, { cropX: 20, cropY: 20, cropWidth: 60, cropHeight: 45 }],
  ] satisfies Array<[CropHandle, number, number, CropRect]>)(
    'resizes the %s corner proportionally around its opposite anchor',
    (handle, dx, dy, expected) => {
      expect(resizeCrop(crop, handle, dx, dy)).toEqual(expected);
    }
  );

  it('creates a true square in image pixels from rectangular source images', () => {
    const landscape = toSquareCrop({ cropX: 0, cropY: 0, cropWidth: 100, cropHeight: 100 }, 1.5);
    expect(landscape.cropWidth).toBeCloseTo(100 / 1.5);
    expect(landscape.cropHeight).toBeCloseTo(100);
    expect(landscape.cropX).toBeCloseTo(100 / 6);
    expect(landscape.cropY).toBeCloseTo(0);

    const portrait = toSquareCrop({ cropX: 0, cropY: 0, cropWidth: 100, cropHeight: 100 }, 0.75);
    expect(portrait.cropWidth).toBeCloseTo(100);
    expect(portrait.cropHeight).toBeCloseTo(75);
    expect(portrait.cropY).toBeCloseTo(12.5);
  });

  it('locks corner and edge resizing to the actual square image ratio', () => {
    const square: CropRect = { cropX: 20, cropY: 20, cropWidth: 40, cropHeight: 60 };
    const corner = resizeSquareCrop(square, 'se', 10, 0, 1.5);
    expect(corner.cropX).toBeCloseTo(20);
    expect(corner.cropY).toBeCloseTo(20);
    expect(corner.cropWidth).toBeCloseTo(50);
    expect(corner.cropHeight).toBeCloseTo(75);

    const edge = resizeSquareCrop(square, 'w', -10, 0, 1.5);
    expect(edge.cropWidth).toBeCloseTo(50);
    expect(edge.cropHeight).toBeCloseTo(75);
    expect(edge.cropX).toBeCloseTo(10);
    expect(edge.cropY).toBeCloseTo(12.5);

    for (const resized of [corner, edge, resizeSquareCrop(square, 'nw', -100, -100, 1.5)]) {
      expect(resized.cropWidth * 1.5).toBeCloseTo(resized.cropHeight);
      expect(resized.cropX).toBeGreaterThanOrEqual(0);
      expect(resized.cropY).toBeGreaterThanOrEqual(0);
      expect(resized.cropX + resized.cropWidth).toBeLessThanOrEqual(100.000001);
      expect(resized.cropY + resized.cropHeight).toBeLessThanOrEqual(100.000001);
    }
  });

  it('enforces a five-percent minimum edge and image bounds', () => {
    expect(resizeCrop(crop, 'e', -100, 0).cropWidth).toBe(5);
    expect(resizeCrop(crop, 's', 0, 100).cropHeight).toBe(80);
    const corner = resizeCrop(crop, 'se', 100, 100);
    expect(corner.cropX + corner.cropWidth).toBeLessThanOrEqual(100);
    expect(corner.cropY + corner.cropHeight).toBeLessThanOrEqual(100);
    expect(corner.cropWidth / corner.cropHeight).toBeCloseTo(4 / 3);
  });
});
