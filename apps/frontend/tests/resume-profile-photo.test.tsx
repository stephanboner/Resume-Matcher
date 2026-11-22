import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import {
  ResumePhotoLayout,
  getPhotoDisplayDimensions,
} from '@/components/resume/resume-profile-photo';
import type { ResumePhotoSettings } from '@/components/dashboard/resume-component';

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

  it('respects larger photo sizes in square mode', () => {
    expect(getPhotoDisplayDimensions(136, 0.6, true)).toEqual({
      width: 136,
      height: 136,
    });
  });
});
