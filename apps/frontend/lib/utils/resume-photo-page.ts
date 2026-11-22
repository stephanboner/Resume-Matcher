import { mmToPx } from '@/lib/constants/page-dimensions';

/**
 * Portraits are positioned relative to the physical paper, including its
 * top margin. Keep at least 5px inside the sheet to avoid print clipping.
 * Never modify the document margins or the CV's text flow.
 */
export function getPhotoTopShiftPx(marginTopMm: number): number {
  const marginTopPx = mmToPx(Number.isFinite(marginTopMm) ? marginTopMm : 10);
  return Math.max(0, Math.min(32, marginTopPx - 5));
}

export function getPagePhotoTopPx(marginTopMm: number): number {
  return mmToPx(marginTopMm) - getPhotoTopShiftPx(marginTopMm);
}
