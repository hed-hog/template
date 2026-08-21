import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { DEFAULT_FILE, getIconForFile } from 'vscode-icons-js';

import {
  FileTypeIcon,
  mimeTypeToSyntheticFilename,
  resolveIconFilename,
} from './file-type-icon';

describe('mimeTypeToSyntheticFilename', () => {
  it('mapeia famílias de mídia', () => {
    expect(mimeTypeToSyntheticFilename('video/mp4')).toBe('file.mp4');
    expect(mimeTypeToSyntheticFilename('audio/mpeg')).toBe('file.mp3');
    expect(mimeTypeToSyntheticFilename('image/png')).toBe('file.png');
    expect(mimeTypeToSyntheticFilename('image/svg+xml')).toBe('file.svg');
    expect(mimeTypeToSyntheticFilename('image/webp')).toBe('file.webp');
    expect(mimeTypeToSyntheticFilename('image/avif')).toBe('file.avif');
  });

  it('mapeia documentos do office (por tipo exato e por sufixo -ml)', () => {
    expect(mimeTypeToSyntheticFilename('application/pdf')).toBe('file.pdf');
    expect(mimeTypeToSyntheticFilename('application/vnd.ms-excel')).toBe(
      'file.xlsx'
    );
    expect(
      mimeTypeToSyntheticFilename(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
    ).toBe('file.xlsx');
    expect(mimeTypeToSyntheticFilename('application/msword')).toBe('file.docx');
    expect(
      mimeTypeToSyntheticFilename(
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      )
    ).toBe('file.pptx');
  });

  it('mapeia arquivos compactados para file.zip', () => {
    for (const mime of [
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      'application/gzip',
      'application/x-tar',
    ]) {
      expect(mimeTypeToSyntheticFilename(mime)).toBe('file.zip');
    }
  });

  it('mapeia texto/dados', () => {
    expect(mimeTypeToSyntheticFilename('text/csv')).toBe('file.csv');
    expect(mimeTypeToSyntheticFilename('text/plain')).toBe('file.txt');
    expect(mimeTypeToSyntheticFilename('application/json')).toBe('file.json');
    expect(mimeTypeToSyntheticFilename('application/xml')).toBe('file.xml');
    // 'text/xml' bate no prefixo 'text/' antes da regra de xml → file.txt
    expect(mimeTypeToSyntheticFilename('text/xml')).toBe('file.txt');
  });

  it('tipo desconhecido → string vazia', () => {
    expect(mimeTypeToSyntheticFilename('application/octet-stream')).toBe('');
  });
});

describe('resolveIconFilename', () => {
  it('usa a extensão do filename quando reconhecida', () => {
    expect(resolveIconFilename('report.pdf', undefined)).toBe(
      getIconForFile('report.pdf')
    );
  });

  it('cai no mime sintético quando o filename não tem extensão', () => {
    expect(resolveIconFilename('semext', 'application/pdf')).toBe(
      getIconForFile('file.pdf')
    );
  });

  it('trata os mimes proprietários de vídeo (sem "/")', () => {
    const expected = getIconForFile('file.mp4');
    expect(resolveIconFilename('clip', 'video_original')).toBe(expected);
    expect(resolveIconFilename('clip', 'video_profile:720p')).toBe(expected);
    expect(expected).not.toBe(DEFAULT_FILE);
  });

  it('sem extensão nem mime resolve para o ícone default', () => {
    expect(resolveIconFilename('misterio', undefined)).toBe(DEFAULT_FILE);
  });
});

describe('<FileTypeIcon />', () => {
  it('renderiza <img> com o src do ícone derivado do mime', () => {
    const { container } = render(
      <FileTypeIcon filename="semext" mimeType="application/pdf" />
    );
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toContain(getIconForFile('file.pdf'));
  });

  it('cai no ícone de fallback (lucide File) quando a imagem falha ao carregar', () => {
    const { container } = render(
      <FileTypeIcon
        filename="report.pdf"
        size={24}
        className="custom-class"
      />
    );
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img).toBeInTheDocument();

    fireEvent.error(img);

    expect(container.querySelector('img')).not.toBeInTheDocument();
    const fallbackIcon = container.querySelector('svg.custom-class');
    expect(fallbackIcon).toBeInTheDocument();
  });
});
