import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import {
  ResumePhotoLayout,
  getPhotoDisplayDimensions,
} from '@/components/resume/resume-profile-photo';
import type { ResumePhotoSettings } from '@/components/dashboard/resume-component';
import { fitSquarePhotoAroundText, fitSquarePhotoBeforeSection } from '@/lib/utils/resume-photo-fit';
import { PHOTO_PAGE_INSET_MM, getPhotoTopShiftPx, getPhotoRightShiftPx, getPagePhotoTopPx, getPagePhotoRightPx } from '@/lib/utils/resume-photo-page';

vi.mock('@/lib/api/resume', () => ({
  getResumePhotoUrl: (resumeId: string, version: number) =>
    `/api/v1/resumes/${resumeId}/photo?v=${version}`,
}));

const photo: ResumePhotoSettings = {
  cropX: 0,
  cropY: 0,
  cropWidth: 100,
  cropHeight: 100,
  size: 88,
  aspectRatio: 0.8,
  version: 1,
  visible: true,
};

describe('resume photo layout', () => {
  it('preserves the adaptive aspect ratio for other templates', () => {
    expect(getPhotoDisplayDimensions(88, 0.8)).toEqual({ width: 70.4, height: 88 });
  });

  it('enlarges an existing portrait and renders a square in Modern Deedy', () => {
    const { container } = render(
      <ResumePhotoLayout resumeId="test" name="Example" template="modern-deedy" photo={photo}>
        <div>Resume content</div>
      </ResumePhotoLayout>
    );
    const wrapper = container.querySelector('[data-photo-overlay]');
    expect(wrapper).toHaveStyle({ '--resume-profile-photo-size': '120px' });
    const photoElement = container.querySelector('.resume-profile-photo');
    expect(photoElement).toHaveStyle({ width: '120px', height: '120px' });
    expect(photoElement?.querySelector('img')).toHaveAttribute(
      'src',
      '/api/v1/resumes/test/photo?v=1'
    );
  });

  it('does not create a photo wrapper when the picture is hidden', () => {
    const { container } = render(
      <ResumePhotoLayout
        resumeId="test"
        name="Example"
        template="modern-deedy"
        photo={{ ...photo, visible: false }}
      >
        <div>Resume content</div>
      </ResumePhotoLayout>
    );
    expect(container.querySelector('[data-photo-overlay]')).toBeNull();
    expect(container.textContent).toBe('Resume content');
  });

  it('pins print photos into the page top margin rather than over the summary', () => {
    const css = readFileSync(
      join(process.cwd(), 'components/resume/styles/resume-profile-photo.module.css'),
      'utf8'
    );
    const placement = css.match(/\.modernDeedy\s+\.photo\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(placement).toMatch(/top:\s*calc\(0px - var\(--resume-profile-photo-top-shift/);
    expect(placement).toMatch(/right:\s*calc\(0px - var\(--resume-profile-photo-right-shift/);
    expect(placement).not.toMatch(/padding|transform/);
    const image = css.match(/\.modernDeedy\s+\.image\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(image).toMatch(/object-position:\s*center top\s*;/);
  });

  it('anchors to the physical TOP-RIGHT corner instead of content margins', () => {
    const insetPx = PHOTO_PAGE_INSET_MM * 96 / 25.4;
    expect(getPagePhotoTopPx(10)).toBeCloseTo(insetPx, 6);
    expect(getPagePhotoRightPx(10)).toBeCloseTo(insetPx, 6);
    expect(getPagePhotoTopPx(5)).toBeCloseTo(insetPx, 6);
    expect(getPagePhotoRightPx(5)).toBeCloseTo(insetPx, 6);
    expect(getPhotoTopShiftPx(10) + getPagePhotoTopPx(10)).toBeCloseTo(10 * 96 / 25.4, 6);
    expect(getPhotoRightShiftPx(10) + getPagePhotoRightPx(10)).toBeCloseTo(10 * 96 / 25.4, 6);
  });

  it('shrinks the square only enough to avoid the first summary line', () => {
    // Based on a CV where a 120px photo would cover the first line of the summary.
    const fitted = fitSquarePhotoAroundText(
      120,
      { top: 100, right: 1300 },
      [
        { left: 80, right: 940, top: 160, bottom: 180 }, // contact details, safely on the left
        { left: 80, right: 1270, top: 292, bottom: 319 }, // full-width summary line
      ],
      1.7,
      5
    );
    expect(fitted).toBeGreaterThan(100);
    expect(fitted).toBeLessThan(120);
    // In the example, the bottom of the image must sit above the summary's first line.
    expect(100 + fitted * 1.7 + 5 * 1.7).toBeLessThanOrEqual(292);
  });

  it('does not shrink a photo with sufficient empty header space', () => {
    expect(fitSquarePhotoAroundText(
      120,
      { top: 100, right: 1300 },
      [{ left: 80, right: 800, top: 130, bottom: 175 }],
      1.7
    )).toBe(120);
  });

  it('never obscures text even with a crowded header', () => {
    expect(fitSquarePhotoAroundText(
      120,
      { top: 100, right: 1300 },
      [{ left: 1100, right: 1300, top: 100, bottom: 190 }]
    )).toBe(0);
  });

  it('ends the portrait above the SUMMARY heading even when heading text is far to the left', () => {
    // Screenshot: the 120px portrait was entirely visible, but its bottom
    // extended beyond the beginning of SUMMARY at viewport y=231.
    const photoTop = 89;
    const summaryTop = 231;
    const scale = 1.45;
    const safe = fitSquarePhotoBeforeSection(120, photoTop, summaryTop, scale);
    expect(safe).toBeLessThan(120);
    expect(safe).toBeGreaterThan(80);
    expect(photoTop + safe * scale + 8 * scale).toBeLessThanOrEqual(summaryTop);
  });

  it('does not resize the portrait when the first section starts below it', () => {
    expect(fitSquarePhotoBeforeSection(120, 100, 330, 1.5)).toBe(120);
    expect(fitSquarePhotoBeforeSection(120, 100, undefined, 1.5)).toBe(120);
  });

  it('hides an overlay if there is not enough room before the first section', () => {
    expect(fitSquarePhotoBeforeSection(120, 100, 104, 1)).toBe(0);
  });

  it('respects larger photo sizes in square mode', () => {
    expect(getPhotoDisplayDimensions(136, 0.6, true)).toEqual({
      width: 136,
      height: 136,
    });
  });
});
