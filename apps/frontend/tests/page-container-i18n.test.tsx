import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PageContainer } from '@/components/preview/page-container';
import { mmToPx } from '@/lib/constants/page-dimensions';

// Reported on Discord: "PAGE 1 OF 3" stayed English in every interface language.
vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({
    t: (key: string, params?: Record<string, string | number>) =>
      `${key}:${params?.page}/${params?.total}`,
  }),
}));

describe('PageContainer page indicator', () => {
  it('is translated, with the page number and total as parameters', () => {
    render(
      <PageContainer
        pageSize="A4"
        margins={{ top: 10, right: 10, bottom: 10, left: 10 }}
        pageNumber={1}
        totalPages={3}
        scale={1}
        showMarginGuides={false}
      >
        <p>content</p>
      </PageContainer>
    );

    expect(screen.getByText('preview.pageOfTotal:1/3')).toBeInTheDocument();
    expect(screen.queryByText(/Page 1 of 3/)).not.toBeInTheDocument();
  });

  it('draws a photo in the PAPER layer outside the clipped text area', () => {
    const { container } = render(
      <PageContainer
        pageSize="A4"
        margins={{ top: 10, right: 10, bottom: 10, left: 10 }}
        pageNumber={1}
        totalPages={1}
        scale={1}
        showMarginGuides={false}
        pagePortrait={{ url: '/api/photo.webp', alt: 'Portrait', size: 120 }}
      >
        <section data-resume-section="true">SUMMARY</section>
      </PageContainer>
    );
    const photo = container.querySelector<HTMLImageElement>('[data-paper-photo="true"]');
    const clippedText = container.querySelector('.overflow-hidden');
    expect(photo).not.toBeNull();
    expect(clippedText).not.toBeNull();
    expect(clippedText?.contains(photo)).toBe(false);
    expect(photo?.getAttribute('src')).toBe('/api/photo.webp');
    expect(Number.parseFloat(photo?.style.top ?? 'NaN')).toBeCloseTo(mmToPx(4), 5);
    expect(Number.parseFloat(photo?.style.right ?? 'NaN')).toBeCloseTo(mmToPx(4), 5);
    expect(Number.parseFloat(photo?.style.top ?? 'NaN')).toBeLessThan(mmToPx(10));
    expect(photo?.style.width).toBe('120px');
  });

  it('keeps page 2 free of the first-page portrait', () => {
    const { container } = render(
      <PageContainer
        pageSize="A4"
        margins={{ top: 10, right: 10, bottom: 10, left: 10 }}
        pageNumber={2}
        totalPages={2}
        scale={1}
        showMarginGuides={false}
        pagePortrait={{ url: '/api/photo.webp', alt: 'Portrait', size: 120 }}
      >
        <p>Second page</p>
      </PageContainer>
    );
    expect(container.querySelector('[data-paper-photo]')).toBeNull();
  });

  it('always clips to the printable area without changing page geometry', () => {
    const { container } = render(
      <PageContainer
        pageSize="A4"
        margins={{ top: 10, right: 10, bottom: 10, left: 10 }}
        pageNumber={1}
        totalPages={2}
        scale={1}
        showMarginGuides={false}
      >
        <p>Resume text</p>
      </PageContainer>
    );

    expect(container.querySelector('.absolute.overflow-hidden')).not.toBeNull();
    expect(container.querySelector('.absolute.overflow-visible')).toBeNull();
  });
});
