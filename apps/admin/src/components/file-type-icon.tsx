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

/**
 * Ícone colorido da categoria, para quando o específico some do CDN (o
 * `file_type_webp.svg`, por exemplo, deixou de existir no vscode-icons).
 */
function categoryIconFilename(filename: string, mimeType?: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const mime = mimeType ?? '';
  if (mime.startsWith('image/') || ['webp', 'avif', 'heic', 'gif', 'bmp', 'png', 'jpg', 'jpeg'].includes(ext))
    return 'file_type_image.svg';
  if (mime.startsWith('video/')) return 'file_type_video.svg';
  if (mime.startsWith('audio/')) return 'file_type_audio.svg';
  if (mime === 'application/pdf' || ext === 'pdf') return 'file_type_pdf.svg';
  return null;
}

export function FileTypeIcon({ filename, mimeType, size = 16, className }: FileTypeIconProps) {
  const iconFilename = resolveIconFilename(filename, mimeType);
  const category = categoryIconFilename(filename, mimeType);
  const candidates = [iconFilename, category, DEFAULT_FILE].filter(
    (name, index, all): name is string => Boolean(name) && all.indexOf(name) === index
  );
  const [attempt, setAttempt] = useState(0);

  if (attempt >= candidates.length) {
    return (
      <FileIcon
        style={{ width: size, height: size }}
        className={cn('shrink-0 text-muted-foreground', className)}
      />
    );
  }

  return (
    <img
      src={`${CDN_BASE}/${candidates[attempt]}`}
      alt=""
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      onError={() => setAttempt((value) => value + 1)}
    />
  );
}
