'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { ResumePhotoSettings } from '@/components/dashboard/resume-component';
import { getResumePhotoUrl } from '@/lib/api/resume';
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
  editable,
  editLabel,
  profilePhotoLabel,
  onEditPhoto,
}: ResumePhotoLayoutProps) {
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
  }, [resumeId, photo?.version]);

  if (!resumeId || !photo || photo.visible === false || loadFailed) {
    return <>{children}</>;
  }

  // Enlarge existing smaller photos in Modern Deedy without migrating their data.
  // Other templates retain their adaptive sizing and crop behaviour.
  const modernDeedy = template === 'modern-deedy';
  const displaySize = modernDeedy ? Math.max(120, photo.size) : photo.size;
  const layoutStyle: CSSProperties | undefined = modernDeedy
    ? ({ '--resume-profile-photo-size': `${displaySize}px` } as CSSProperties)
    : undefined;

  return (
    <div
      data-photo-overlay="true"
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
