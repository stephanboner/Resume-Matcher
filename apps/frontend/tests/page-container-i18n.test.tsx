import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PageContainer } from '@/components/preview/page-container';

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

  it('shows photo overflow into the first page margin without changing content geometry', () => {
    const { container } = render(
      <PageContainer
        pageSize="A4"
        margins={{ top: 10, right: 10, bottom: 10, left: 10 }}
        pageNumber={1}
        totalPages={2}
        scale={1}
        showMarginGuides={false}
        allowTopOverflow
      >
        <p>Resume text</p>
      </PageContainer>
    );

    const content = container.querySelector('.overflow-visible');
    expect(content).not.toBeNull();
    expect((content as HTMLElement).style.clipPath).toMatch(/^inset\(-[\d.]+px 0 0 0\)$/);
    expect((content as HTMLElement).style.left).not.toBe('');
  });

  it('keeps later pages clipped even when top overflow is requested', () => {
    const { container } = render(
      <PageContainer
        pageSize="A4"
        margins={{ top: 10, right: 10, bottom: 10, left: 10 }}
        pageNumber={2}
        totalPages={2}
        scale={1}
        showMarginGuides={false}
        allowTopOverflow
      >
        <p>Resume text</p>
      </PageContainer>
    );

    expect(container.querySelector('.overflow-visible')).toBeNull();
    expect(container.querySelector('.overflow-hidden')).not.toBeNull();
  });
});
