import { mmToPx } from '@/lib/constants/page-dimensions';

/**
 * Anchor the photo to the physical top-right corner of the sheet, rather
 * than the CV text margins. Four millimetres provides a practical print inset.
 */
export const PHOTO_PAGE_INSET_MM = 4;

function safeMarginPx(marginMm: number): number {
  return mmToPx(Number.isFinite(marginMm) ? Math.max(0, marginMm) : 10);
}

function photoShiftPx(marginMm: number): number {
  return Math.max(0, safeMarginPx(marginMm) - mmToPx(PHOTO_PAGE_INSET_MM));
}

/** How far to lift the print photo above the content's top edge. */
export function getPhotoTopShiftPx(marginTopMm: number): number {
  return photoShiftPx(marginTopMm);
}

/** How far to shift the print photo right of the text content edge. */
export function getPhotoRightShiftPx(marginRightMm: number): number {
  return photoShiftPx(marginRightMm);
}

/** Offset from the physical top sheet edge for the paginated preview. */
export function getPagePhotoTopPx(marginTopMm: number): number {
  return safeMarginPx(marginTopMm) - getPhotoTopShiftPx(marginTopMm);
}

/** Offset from the physical right sheet edge for the paginated preview. */
export function getPagePhotoRightPx(marginRightMm: number): number {
  return safeMarginPx(marginRightMm) - getPhotoRightShiftPx(marginRightMm);
}
