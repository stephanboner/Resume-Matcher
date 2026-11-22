'use client';

import { useEffect, useMemo, useState } from 'react';
import { SpinnerGap as Loader2 } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { PhotoMutation, ResumePhotoSettings } from '@/components/dashboard/resume-component';
import { AdaptiveCropBox, toSquareCrop, type CropRect } from '@/components/builder/adaptive-crop-box';
import { useTranslations } from '@/lib/i18n';

const DEFAULT_SIZE = 88;
const MIN_SQUARE_SIZE = 120;
const MAX_SIZE = 144;
const FULL_IMAGE_CROP: CropRect = {
  cropX: 0,
  cropY: 0,
  cropWidth: 100,
  cropHeight: 100,
};

interface ProfilePhotoEditorDialogProps {
  open: boolean;
  sourceUrl: string | null;
  initialSettings?: ResumePhotoSettings;
  squarePhoto?: boolean;
  applying?: boolean;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onApply: (mutation: PhotoMutation) => Promise<void>;
}

export function ProfilePhotoEditorDialog({
  open,
  sourceUrl,
  initialSettings,
  squarePhoto = false,
  applying = false,
  error,
  onOpenChange,
  onApply,
}: ProfilePhotoEditorDialogProps) {
  const { t } = useTranslations();
  const defaultSize = squarePhoto ? MIN_SQUARE_SIZE : DEFAULT_SIZE;
  const [size, setSize] = useState(Math.max(squarePhoto ? MIN_SQUARE_SIZE : 64, initialSettings?.size ?? defaultSize));
  const [crop, setCrop] = useState<CropRect>(FULL_IMAGE_CROP);
  const [sourceAspectRatio, setSourceAspectRatio] = useState<number | null>(null);

  const initialCrop = useMemo<CropRect>(() => {
    if (!initialSettings) return FULL_IMAGE_CROP;
    return {
      cropX: initialSettings.cropX,
      cropY: initialSettings.cropY,
      cropWidth: initialSettings.cropWidth,
      cropHeight: initialSettings.cropHeight,
    };
  }, [initialSettings]);

  useEffect(() => {
    if (!open) return;
    setCrop(initialCrop);
    setSourceAspectRatio(null);
    setSize(Math.max(squarePhoto ? MIN_SQUARE_SIZE : 64, initialSettings?.size ?? defaultSize));
  }, [defaultSize, initialCrop, initialSettings?.size, open, squarePhoto]);

  const handleReset = () => {
    setCrop(
      squarePhoto && sourceAspectRatio
        ? toSquareCrop(FULL_IMAGE_CROP, sourceAspectRatio)
        : FULL_IMAGE_CROP
    );
    setSize(defaultSize);
  };

  const handleApply = async () => {
    await onApply({
      ...crop,
      size,
      visible: initialSettings?.visible !== false,
    });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (applying && !nextOpen) return;
    onOpenChange(nextOpen);
  };

  const handleLabels = useMemo(
    () => ({
      n: t('resume.photo.cropHandles.n'),
      s: t('resume.photo.cropHandles.s'),
      e: t('resume.photo.cropHandles.e'),
      w: t('resume.photo.cropHandles.w'),
      nw: t('resume.photo.cropHandles.nw'),
      ne: t('resume.photo.cropHandles.ne'),
      sw: t('resume.photo.cropHandles.sw'),
      se: t('resume.photo.cropHandles.se'),
    }),
    [t]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="lg" className="max-w-2xl p-0">
        <DialogHeader className="border-b border-black p-6">
          <DialogTitle className="text-2xl uppercase">{t('resume.photo.dialogTitle')}</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {t('resume.photo.dialogDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 p-6">
          <div className="border-2 border-black bg-black">
            {sourceUrl && (
              <AdaptiveCropBox
                imageUrl={sourceUrl}
                value={crop}
                onChange={setCrop}
                squareAspectRatio={squarePhoto ? sourceAspectRatio ?? undefined : undefined}
                onSourceLoad={(ratio) => {
                  setSourceAspectRatio(ratio);
                  if (squarePhoto) setCrop(toSquareCrop(initialCrop, ratio));
                }}
                imageAlt={t('resume.photo.profilePhoto')}
                disabled={applying}
                moveLabel={t('resume.photo.moveCrop')}
                handleLabels={handleLabels}
              />
            )}
          </div>

          <div>
            <label className="space-y-2">
              <span className="block font-mono text-xs uppercase tracking-wider">
                {t('resume.photo.size')}: {size}px
              </span>
              <input
                aria-label={t('resume.photo.size')}
                type="range"
                min={squarePhoto ? MIN_SQUARE_SIZE : 64}
                max={MAX_SIZE}
                step="1"
                value={size}
                onChange={(event) => setSize(Number(event.target.value))}
                className="w-full accent-primary"
              />
            </label>
          </div>

          {error && (
            <div role="alert" className="border-2 border-destructive bg-destructive-tint p-3 text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-end gap-3 border-t border-black bg-panel p-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={applying}>
            {t('common.cancel')}
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={applying}>
            {t('resume.photo.reset')}
          </Button>
          <Button onClick={handleApply} disabled={applying || !sourceUrl}>
            {applying && <Loader2 className="h-4 w-4 animate-spin" />}
            {applying ? t('resume.photo.applying') : t('common.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
