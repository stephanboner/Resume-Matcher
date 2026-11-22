'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { ResumePhotoSettings } from '@/components/dashboard/resume-component';
import { getResumePhotoUrl } from '@/lib/api/resume';
import { fitSquarePhotoAroundText, fitSquarePhotoBeforeSection, type PhotoTextRect } from '@/lib/utils/resume-photo-fit';
import { getPhotoTopShiftPx, getPhotoRightShiftPx } from '@/lib/utils/resume-photo-page';
import styles from './styles/resume-profile-photo.module.css';

interface ResumeProfilePhotoProps {
  resumeId: string;
  name: string;
  photo: ResumePhotoSettings;
  square?: boolean;
  displaySize?: number;
  editable?: boolean;
  editLabel: string;
  profilePhotoLabel: string;
  onEditPhoto?: () => void;
  onLoadError: () => void;
}

export function getPhotoDisplayDimensions(
  size: number,
  aspectRatio: number,
  square = false
): { width: number; height: number } {
  if (square) return { width: size, height: size };
  const ratio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1;
  if (ratio >= 1) {
    return { width: size, height: size / ratio };
  }
  return { width: size * ratio, height: size };
}

function ResumeProfilePhoto({
  resumeId,
  name,
  photo,
  square = false,
  displaySize,
  editable = false,
  editLabel,
  profilePhotoLabel,
  onEditPhoto,
  onLoadError,
}: ResumeProfilePhotoProps) {
  const dimensions = getPhotoDisplayDimensions(displaySize ?? photo.size, photo.aspectRatio, square);
  return (
    <div className={`resume-profile-photo ${styles.photo}`} style={dimensions}>
      {/* Browser-native img loading is required so Playwright can await decode(). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getResumePhotoUrl(resumeId, photo.version)}
        alt={`${name} ${profilePhotoLabel}`.trim()}
        className={styles.image}
        onError={onLoadError}
      />
      {editable && onEditPhoto && (
        <button
          type="button"
          className={`${styles.editHitTarget} print:hidden`}
          onClick={onEditPhoto}
          aria-label={editLabel}
        />
      )}
    </div>
  );
}

interface ResumePhotoLayoutProps {
  children: ReactNode;
  resumeId?: string;
  name?: string;
  photo?: ResumePhotoSettings;
  template?: string;
  renderPhoto?: boolean;
  photoMarginTopMm?: number;
  photoMarginRightMm?: number;
  editable?: boolean;
  editLabel?: string;
  profilePhotoLabel?: string;
  onEditPhoto?: () => void;
}

export function ResumePhotoLayout({
  children,
  resumeId,
  name = '',
  photo,
  template,
  renderPhoto = true,
  photoMarginTopMm = 10,
  photoMarginRightMm = 10,
  editable,
  editLabel,
  profilePhotoLabel,
  onEditPhoto,
}: ResumePhotoLayoutProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const [safePhotoSize, setSafePhotoSize] = useState<number | null>(null);
  const [photoFitReady, setPhotoFitReady] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const modernDeedy = template === 'modern-deedy';
  const photoVisible = Boolean(renderPhoto && resumeId && photo && photo.visible !== false && !loadFailed);
  const topShiftPx = getPhotoTopShiftPx(photoMarginTopMm);
  const rightShiftPx = getPhotoRightShiftPx(photoMarginRightMm);
  // Try to keep the requested large square, but never sacrifice the underlying text.
  const desiredSize = modernDeedy ? Math.max(120, photo?.size ?? 120) : photo?.size ?? 88;

  useEffect(() => {
    setLoadFailed(false);
  }, [resumeId, photo?.version]);

  useLayoutEffect(() => {
    if (!modernDeedy || !photoVisible || !wrapperRef.current) return;
    const wrapper = wrapperRef.current;
    const textRoot = wrapper.querySelector<HTMLElement>('.resume-template-modern-deedy');
    if (!textRoot) return;

    let active = true;
    const measure = () => {
      if (!active) return;
      const frame = wrapper.getBoundingClientRect();
      const scale = wrapper.offsetWidth > 0 ? frame.width / wrapper.offsetWidth : 1;
      if (frame.width <= 0) return;

      // Measure actual rendered text lines, not the broad full-width section boxes.
      // This leaves empty header space available and catches wrapped summary lines.
      const lines: PhotoTextRect[] = [];
      const range = document.createRange();
      // The heading/section boundary check also works in test environments
      // where Range.getClientRects is unavailable.
      if (typeof range.getClientRects === 'function') {
        const walker = document.createTreeWalker(textRoot, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        while ((node = walker.nextNode())) {
          if (!node.textContent?.trim()) continue;
          range.selectNodeContents(node);
          for (const rect of Array.from(range.getClientRects())) {
            if (rect.width > 0 && rect.height > 0) {
              lines.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
            }
          }
        }
      }
      range.detach?.();

      const portraitTop = frame.top - topShiftPx * scale;
      const collisionSafeSize = fitSquarePhotoAroundText(
        desiredSize, { top: portraitTop, right: frame.right + rightShiftPx * scale }, lines, scale
      );

      // A short heading such as SUMMARY may sit entirely left of the portrait,
      // yet the portrait must not extend into that section's vertical area.
      // Reserve a gap before the first section WITHOUT changing any text positions.
      const firstSection = wrapper.querySelector<HTMLElement>('[data-resume-section]');
      const sectionSafeSize = fitSquarePhotoBeforeSection(
        desiredSize, portraitTop, firstSection?.getBoundingClientRect().top, scale
      );
      const fitted = Math.min(collisionSafeSize, sectionSafeSize);
      setSafePhotoSize((previous) => previous === fitted ? previous : fitted);
      setPhotoFitReady(true);
    };

    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(textRoot);
    observer?.observe(wrapper);
    window.addEventListener('resize', measure);
    void document.fonts?.ready.then(measure);
    return () => {
      active = false;
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [modernDeedy, photoVisible, desiredSize, topShiftPx, rightShiftPx]);

  if (!renderPhoto || !resumeId || !photo || photo.visible === false || loadFailed) {
    return <>{children}</>;
  }

  const displaySize = modernDeedy ? Math.min(desiredSize, safePhotoSize ?? desiredSize) : photo.size;
  const layoutStyle: CSSProperties | undefined = modernDeedy
    ? ({
        '--resume-profile-photo-size': `${displaySize}px`,
        '--resume-profile-photo-top-shift': `${topShiftPx}px`,
        '--resume-profile-photo-right-shift': `${rightShiftPx}px`,
      } as CSSProperties)
    : undefined;

  return (
    <div
      ref={wrapperRef}
      data-photo-overlay="true"
      data-photo-fit-ready={!modernDeedy || photoFitReady ? "true" : "false"}
      className={`${styles.wrapper} ${modernDeedy ? styles.modernDeedy : ''}`}
      style={layoutStyle}
    >
      {children}
      <ResumeProfilePhoto
        resumeId={resumeId}
        name={name}
        photo={photo}
        square={modernDeedy}
        displaySize={displaySize}
        editable={editable}
        editLabel={editLabel ?? ''}
        profilePhotoLabel={profilePhotoLabel ?? ''}
        onEditPhoto={onEditPhoto}
        onLoadError={() => setLoadFailed(true)}
      />
    </div>
  );
}

export { ResumeProfilePhoto };
