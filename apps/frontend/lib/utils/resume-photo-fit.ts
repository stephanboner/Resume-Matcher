/**
 * Positioning helper for an optional square portrait over a resume.
 *
 * A photo is an absolutely positioned overlay: never change the flow or
 * margins of the underlying CV. If a long header or early section would
 * collide with the photo, scale the portrait down instead.
 *
 * All coordinates use DOM viewport pixels. size/scale are CSS pixels.
 */
export interface PhotoTextRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function fitSquarePhotoAroundText(
  requestedSize: number,
  frame: { top: number; right: number },
  textRects: ReadonlyArray<PhotoTextRect>,
  scale = 1,
  gap = 5
): number {
  if (!Number.isFinite(requestedSize) || requestedSize <= 0) return 0;
  const maxSide = Math.floor(requestedSize);
  const pixelScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const pixelGap = gap * pixelScale;

  for (let size = maxSide; size > 0; size -= 1) {
    const side = size * pixelScale;
    const left = frame.right - side;
    const bottom = frame.top + side;
    const collision = textRects.some((rect) =>
      rect.left < frame.right + pixelGap &&
      rect.right > left - pixelGap &&
      rect.top < bottom + pixelGap &&
      rect.bottom > frame.top - pixelGap
    );
    if (!collision) return size;
  }

  // Never obscure text. In unusually crowded layouts, hide the overlay.
  return 0;
}
