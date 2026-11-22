'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import { fitSquarePhotoAroundText, type PhotoTextRect } from '@/lib/utils/resume-photo-fit';
import { getPagePhotoTopPx, getPagePhotoRightPx } from '@/lib/utils/resume-photo-page';
import { type PageSize, type MarginSettings } from '@/lib/types/template-settings';
import { PAGE_DIMENSIONS, mmToPx } from '@/lib/constants/page-dimensions';
import { useTranslations } from '@/lib/i18n';

export interface PagePortrait {
  url: string;
  alt: string;
  size: number;
}

interface PageContainerProps {
  pageSize: PageSize;
  margins: MarginSettings;
  pageNumber: number;
  totalPages: number;
  scale: number;
  showMarginGuides: boolean;
  children: React.ReactNode;
  contentOffset?: number; // Where this page's content starts (in px)
  contentEnd?: number; // Where this page's content ends (in px)
  /** Photo is a sibling of the clipped content: coordinates are from paper edges. */
  pagePortrait?: PagePortrait;
}

/**
 * PageContainer renders a single page at exact dimensions with optional margin guides.
 * Content is clipped to the printable area (page minus margins).
 * Uses contentOffset and contentEnd to show only the content for this specific page,
 * preventing duplication across pages.
 */
export function PageContainer({
  pageSize,
  margins,
  pageNumber,
  totalPages,
  scale,
  showMarginGuides,
  children,
  contentOffset = 0,
  contentEnd,
  pagePortrait,
}: PageContainerProps) {
  const { t } = useTranslations();
  const paperRef = useRef<HTMLDivElement>(null);
  const [fittedPortraitSize, setFittedPortraitSize] = useState<number | null>(null);
  const [portraitFailed, setPortraitFailed] = useState(false);
  React.useEffect(() => setPortraitFailed(false), [pagePortrait?.url]);
  const pageDims = PAGE_DIMENSIONS[pageSize];
  const pageWidthPx = mmToPx(pageDims.width);
  const pageHeightPx = mmToPx(pageDims.height);

  const marginTopPx = mmToPx(margins.top);
  const marginBottomPx = mmToPx(margins.bottom);
  const marginLeftPx = mmToPx(margins.left);
  const marginRightPx = mmToPx(margins.right);

  const contentWidth = pageWidthPx - marginLeftPx - marginRightPx;
  const maxContentHeight = pageHeightPx - marginTopPx - marginBottomPx;
  const portraitTop = getPagePhotoTopPx(margins.top);
  const portraitRight = getPagePhotoRightPx(margins.right);

  // Calculate the actual visible height for this page
  // If contentEnd is provided, limit the height to avoid showing content that belongs on the next page
  const actualContentHeight = contentEnd
    ? Math.min(maxContentHeight, contentEnd - contentOffset)
    : maxContentHeight;

  // Measure from the physical paper border, NOT the clipped resume content.
  // The photo can use the top page margin, while the original text geometry
  // and pagination remain byte-for-byte identical.
  useLayoutEffect(() => {
    if (!pagePortrait || pageNumber !== 1 || !paperRef.current) return;
    const paper = paperRef.current;
    let active = true;
    const measure = () => {
      if (!active) return;
      const paperRect = paper.getBoundingClientRect();
      // Hidden/test canvases have no geometry; keep the requested photo size.
      if (paperRect.width <= 0 || paperRect.height <= 0) return;
      const pageScale = paperRect.width / pageWidthPx;
      if (!Number.isFinite(pageScale) || pageScale <= 0) return;
      const firstSection = paper.querySelector<HTMLElement>('[data-resume-section]');
      // If the resume has no sections (a blank CV), don't invent a constraint.
      const sectionTop = firstSection?.getBoundingClientRect().top;
      const sectionSpace = sectionTop == null
        ? pagePortrait.size
        : Math.max(0, Math.floor(
            (sectionTop - paperRect.top) / pageScale - portraitTop - 3
          ));
      let fitted = Math.min(pagePortrait.size, sectionSpace);

      // Also account for contact text that may extend unusually far right.
      const textRoot = paper.querySelector<HTMLElement>('.resume-template-modern-deedy');
      if (textRoot && typeof document.createRange === 'function') {
        const range = document.createRange();
        if (typeof range.getClientRects === 'function') {
          const lines: PhotoTextRect[] = [];
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
          range.detach?.();
          const right = paperRect.right - portraitRight * pageScale;
          const top = paperRect.top + portraitTop * pageScale;
          fitted = Math.min(fitted, fitSquarePhotoAroundText(
            fitted, { top, right }, lines, pageScale
          ));
        }
      }
      setFittedPortraitSize((old) => old === fitted ? old : fitted);
    };

    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    const section = paper.querySelector<HTMLElement>('[data-resume-section]');
    if (section) observer?.observe(section);
    const content = paper.querySelector<HTMLElement>('.resume-template-modern-deedy');
    if (content) observer?.observe(content);
    window.addEventListener('resize', measure);
    void document.fonts?.ready.then(measure);
    return () => {
      active = false;
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [pageNumber, pagePortrait?.url, pagePortrait?.size, portraitTop, portraitRight, pageWidthPx, scale]);

  const renderedPortraitSize = Math.min(pagePortrait?.size ?? 0, fittedPortraitSize ?? pagePortrait?.size ?? 0);

  return (
    <div className="relative flex flex-col items-center">
      {/* Page wrapper with scale transform */}
      <div
        ref={paperRef}
        className="relative bg-white border-2 border-ink shadow-sw-card origin-top"
        style={{
          width: pageWidthPx,
          height: pageHeightPx,
          transform: `scale(${scale})`,
          marginBottom: `${pageHeightPx * scale - pageHeightPx + 16}px`,
        }}
      >
        {/* Margin guides overlay */}
        {showMarginGuides && (
          <div
            className="absolute pointer-events-none z-10"
            style={{
              top: marginTopPx,
              left: marginLeftPx,
              width: contentWidth,
              height: maxContentHeight,
              border: '1px dashed color-mix(in srgb, var(--sw-primary) 50%, transparent)',
            }}
          >
            {/* Corner markers */}
            <div className="absolute -top-1 -left-1 size-2 border-t border-l border-primary" />
            <div className="absolute -top-1 -right-1 size-2 border-t border-r border-primary" />
            <div className="absolute -bottom-1 -left-1 size-2 border-b border-l border-primary" />
            <div className="absolute -bottom-1 -right-1 size-2 border-b border-r border-primary" />
          </div>
        )}

        {/* Content area with clipping - uses actualContentHeight to prevent content overlap */}
        <div
          className="absolute overflow-hidden"
          style={{
            top: marginTopPx,
            left: marginLeftPx,
            width: contentWidth,
            height: actualContentHeight,
          }}
        >
          {/* Content positioned based on page offset */}
          <div
            className="absolute left-0 right-0"
            style={{
              top: -contentOffset,
              width: contentWidth,
            }}
          >
            {children}
          </div>
        </div>

        {/* Page-level first-page portrait. A sibling of the clipped content so
            the top paper margin is available without overflow/clip hacks. */}
        {pagePortrait && pageNumber === 1 && renderedPortraitSize > 0 && !portraitFailed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            data-paper-photo="true"
            src={pagePortrait.url}
            alt={pagePortrait.alt}
            onError={() => setPortraitFailed(true)}
            className="absolute z-20 bg-white"
            style={{
              top: portraitTop,
              right: portraitRight,
              width: renderedPortraitSize,
              height: renderedPortraitSize,
              border: '1px solid var(--resume-border-primary)',
              objectFit: 'cover',
              objectPosition: 'center top',
            }}
          />
        )}

        {/* Page number indicator */}
        <div
          className="absolute bottom-2 right-3 font-mono text-xs text-steel uppercase tracking-wider tabular-nums"
          style={{ transform: `scale(${1 / scale})`, transformOrigin: 'bottom right' }}
        >
          {t('preview.pageOfTotal', { page: pageNumber, total: totalPages })}
        </div>
      </div>
    </div>
  );
}
