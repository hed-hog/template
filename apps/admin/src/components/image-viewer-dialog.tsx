'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { downloadFile } from '@/lib/download-file';
import { cn } from '@/lib/utils';
import { Download, ZoomIn, ZoomOut } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';

/**
 * Baixar só faz sentido quando há um arquivo com nome: o avatar de uma pessoa,
 * por exemplo, é servido por id e não tem nome nem extensão para salvar. Por
 * isso a URL e os rótulos andam juntos — ou tem tudo, ou não tem botão.
 */
export type MediaDownload = {
  url: string;
  filename: string;
  label: string;
  errorLabel: string;
};

export type ImageViewerLabels = {
  zoomIn: string;
  zoomOut: string;
};

type MediaViewerDialogProps = {
  /** Título acessível; fica só para o leitor de tela, o conteúdo é a mídia. */
  title: string;
  children: ReactNode;
  /** Passe `trigger` para abrir por clique, ou `open`/`onOpenChange` para controlar. */
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  download?: MediaDownload | null;
  extraAction?: ReactNode;
};

/**
 * Moldura comum da mídia aberta em tela cheia, com o download sempre à mão.
 *
 * Serve imagem, vídeo ou qualquer outro conteúdo que caiba num diálogo: quem
 * decide o que aparece é o `children`.
 */
export function MediaViewerDialog({
  title,
  children,
  trigger,
  open,
  onOpenChange,
  download,
  extraAction,
}: MediaViewerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}

      <DialogContent className="flex max-h-[95vh] max-w-[95vw] flex-col gap-3 p-3 sm:max-w-[90vw]">
        <DialogTitle className="sr-only">{title}</DialogTitle>

        {/* O overflow é o que permite arrastar a mídia ampliada: sem ele o zoom
            só cortaria as bordas, sem deixar chegar nelas. */}
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto">
          {children}
        </div>

        {extraAction || download ? (
          <DialogFooter className="gap-2 sm:justify-center">
            {extraAction}
            {download ? (
              // Baixa pelo blob: o atributo `download` de um link é ignorado
              // quando a origem é outra (a API não está no domínio do admin), e
              // o botão apenas abria o arquivo numa aba.
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!(await downloadFile(download.url, download.filename))) {
                    toast.error(download.errorLabel);
                  }
                }}
              >
                <Download className="mr-1.5 h-4 w-4" />
                {download.label}
              </Button>
            ) : null}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type ImageViewerDialogProps = {
  src: string;
  alt: string;
  labels: ImageViewerLabels;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  download?: MediaDownload | null;
};

/**
 * Imagem em tela cheia com zoom.
 *
 * O zoom é uma escala CSS fixa (`scale-[2]`) sobre o tamanho já ajustado à
 * tela, sem biblioteca: `overflow-auto` da moldura vira a área de arrasto até
 * as bordas ampliadas. Não depende do tamanho intrínseco do arquivo — ao
 * contrário de simplesmente remover o teto de altura, isso amplia de forma
 * visível mesmo quando a foto original já é pequena.
 */
export function ImageViewerDialog({
  src,
  alt,
  labels,
  trigger,
  open,
  onOpenChange,
  download,
}: ImageViewerDialogProps) {
  const [zoomed, setZoomed] = useState(false);

  return (
    <MediaViewerDialog
      title={alt}
      trigger={trigger}
      open={open}
      onOpenChange={(nextOpen) => {
        // Reabrir sempre no tamanho que cabe na tela: o zoom da vez anterior
        // não diz nada sobre a próxima imagem.
        if (!nextOpen) setZoomed(false);
        onOpenChange?.(nextOpen);
      }}
      download={download}
      extraAction={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setZoomed((value) => !value)}
        >
          {zoomed ? (
            <ZoomOut className="mr-1.5 h-4 w-4" />
          ) : (
            <ZoomIn className="mr-1.5 h-4 w-4" />
          )}
          {zoomed ? labels.zoomOut : labels.zoomIn}
        </Button>
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={() => setZoomed((value) => !value)}
        className={cn(
          'max-h-[80vh] w-auto object-contain transition-transform',
          zoomed
            ? 'scale-[2] cursor-zoom-out'
            : 'cursor-zoom-in'
        )}
      />
    </MediaViewerDialog>
  );
}
