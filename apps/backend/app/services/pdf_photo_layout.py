"""Deterministic photo alignment immediately before Chromium exports a resume.

The web preview renders the portrait in its paper layer. The print route has
the normal HTML content margins, so its portrait needs to be offset towards the
physical paper corner. Print media MUST be active before measuring: otherwise
the browser may reflow after we have chosen a size, producing a different PDF.
"""

# Evaluated only for pages carrying the Modern Deedy photo overlay.
PRINT_PHOTO_LAYOUT_JS = r"""
({ topMargin, rightMargin }) => {
  const overlay = document.querySelector('.resume-print [data-photo-overlay][data-photo-template="modern-deedy"]');
  if (!overlay) return null;

  const photo = overlay.querySelector('.resume-profile-photo');
  const content = overlay.querySelector('.resume-template-modern-deedy');
  if (!photo || !content) return null;

  const MM_TO_PX = 96 / 25.4;
  const PAGE_INSET = 4 * MM_TO_PX;
  const GAP_BEFORE_SECTION = 3;
  const TEXT_GAP = 5;

  const marginTop = Math.max(0, Number.parseFloat(topMargin) || 0) * MM_TO_PX;
  const marginRight = Math.max(0, Number.parseFloat(rightMargin) || 0) * MM_TO_PX;
  const topShift = Math.max(0, marginTop - PAGE_INSET);
  const rightShift = Math.max(0, marginRight - PAGE_INSET);

  const frame = overlay.getBoundingClientRect();
  if (frame.width <= 0) return null;

  const portraitTop = frame.top - topShift;
  const portraitRight = frame.right + rightShift;
  const firstSection = content.querySelector('[data-resume-section]');
  const firstSectionTop = firstSection?.getBoundingClientRect().top;
  const desired = Math.max(0, Math.floor(
    Number(overlay.getAttribute('data-photo-requested-size')) || 120
  ));
  const sectionFit = firstSectionTop == null
    ? desired
    : Math.max(0, Math.floor(firstSectionTop - portraitTop - GAP_BEFORE_SECTION));
  const maxSize = Math.min(desired, sectionFit);

  // Text wrapping can differ from the on-screen preview. Use actual print
  // glyph positions so a long contact line can never be covered by the photo.
  const textRects = [];
  if (typeof document.createRange === 'function') {
    const range = document.createRange();
    if (typeof range.getClientRects === 'function') {
      const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (!node.textContent?.trim()) continue;
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (rect.width > 0 && rect.height > 0) {
            textRects.push(rect);
          }
        }
      }
    }
    range.detach?.();
  }

  let size = maxSize;
  for (; size > 0; size--) {
    const left = portraitRight - size;
    const bottom = portraitTop + size;
    if (!textRects.some(rect =>
      rect.left < portraitRight + TEXT_GAP &&
      rect.right > left - TEXT_GAP &&
      rect.top < bottom + TEXT_GAP &&
      rect.bottom > portraitTop - TEXT_GAP
    )) break;
  }

  // Do not alter normal document layout, margins, or page breaks.
  photo.style.top = `-${topShift}px`;
  photo.style.right = `-${rightShift}px`;
  photo.style.width = `${size}px`;
  photo.style.height = `${size}px`;
  photo.style.display = size > 0 ? '' : 'none';
  overlay.style.setProperty('--resume-profile-photo-size', `${size}px`);
  overlay.setAttribute('data-photo-fit-ready', 'true');

  return { size, topShift, rightShift, printMedia: matchMedia('print').matches };
}
"""
