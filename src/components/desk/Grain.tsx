'use client';

import { useHydrated } from '@/components/hooks/useHydrated';

const SIZE = 160;
let cached: string | null = null;

// Grain de pellicule généré une fois dans le navigateur (image data:, permise
// par la CSP) ; le HTML du serveur n'en a pas.
function grainUrl(): string {
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const image = ctx.createImageData(SIZE, SIZE);
  for (let i = 0; i < image.data.length; i += 4) {
    const value = Math.random() * 255;
    image.data[i] = value;
    image.data[i + 1] = value;
    image.data[i + 2] = value;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  cached = `url(${canvas.toDataURL()})`;
  return cached;
}

export function Grain({ className }: { className?: string }) {
  const url = useHydrated() ? grainUrl() : '';
  return (
    <div
      className={className}
      aria-hidden="true"
      style={url ? { backgroundImage: url } : undefined}
    />
  );
}
