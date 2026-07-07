'use client';

import { File as FileIcon } from 'lucide-react';
import { useState } from 'react';
import { DEFAULT_FILE, getIconForFile } from 'vscode-icons-js';

import { cn } from '@/lib/utils';

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/vscode-icons/vscode-icons@master/icons';

export function mimeTypeToSyntheticFilename(mimeType: string): string {
  if (mimeType.startsWith('video/')) return 'file.mp4';
  if (mimeType.startsWith('audio/')) return 'file.mp3';
  if (mimeType === 'image/svg+xml') return 'file.svg';
  if (mimeType === 'image/webp') return 'file.webp';
  if (mimeType === 'image/avif') return 'file.avif';
  if (mimeType.startsWith('image/')) return 'file.png';
  if (mimeType === 'application/pdf') return 'file.pdf';
  if (mimeType === 'application/vnd.ms-excel' || mimeType.includes('spreadsheetml'))
    return 'file.xlsx';
  if (mimeType === 'application/msword' || mimeType.includes('wordprocessingml'))
    return 'file.docx';
  if (mimeType === 'application/vnd.ms-powerpoint' || mimeType.includes('presentationml'))
    return 'file.pptx';
  if (
    mimeType === 'application/zip' ||
    mimeType === 'application/x-zip-compressed' ||
    mimeType === 'application/x-rar-compressed' ||
    mimeType === 'application/x-7z-compressed' ||
    mimeType === 'application/gzip' ||
    mimeType === 'application/x-tar'
  )
    return 'file.zip';
  if (mimeType === 'text/csv') return 'file.csv';
  if (mimeType.startsWith('text/')) return 'file.txt';
  if (mimeType === 'application/json') return 'file.json';
  if (mimeType === 'application/xml' || mimeType === 'text/xml') return 'file.xml';
  return '';
}

export function resolveIconFilename(
  filename: string,
  mimeType: string | undefined
): string {
  let resolvedFilename = filename;

  if (mimeType && !mimeType.includes('/')) {
    if (mimeType === 'video_original' || mimeType.startsWith('video_profile:')) {
      resolvedFilename = 'file.mp4';
    }
  }

  const hasExtension =
    resolvedFilename.includes('.') &&
    resolvedFilename.lastIndexOf('.') < resolvedFilename.length - 1;

  if (hasExtension) {
    const icon = getIconForFile(resolvedFilename);
    if (icon && icon !== DEFAULT_FILE) return icon;
  }

  if (mimeType?.includes('/')) {
    const synthetic = mimeTypeToSyntheticFilename(mimeType);
    if (synthetic) {
      const icon = getIconForFile(synthetic);
      if (icon) return icon;
    }
  }

  return DEFAULT_FILE;
}

interface FileTypeIconProps {
  filename: string;
  mimeType?: string;
  size?: number;
  className?: string;
}

export function FileTypeIcon({ filename, mimeType, size = 16, className }: FileTypeIconProps) {
  const [imgError, setImgError] = useState(false);
  const iconFilename = resolveIconFilename(filename, mimeType);
  const iconUrl = `${CDN_BASE}/${iconFilename}`;

  if (imgError) {
    return (
      <FileIcon
        style={{ width: size, height: size }}
        className={cn('shrink-0 text-muted-foreground', className)}
      />
    );
  }

  return (
    <img
      src={iconUrl}
      alt=""
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      onError={() => setImgError(true)}
    />
  );
}
