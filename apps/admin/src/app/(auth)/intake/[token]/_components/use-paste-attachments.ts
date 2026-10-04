'use client';

import * as React from 'react';

/**
 * Nome para um print colado.
 *
 * O clipboard entrega toda imagem como `image.png`: cinco prints colados
 * chegariam na tarefa com o mesmo nome. A data da colagem desempata e ainda diz
 * algo a quem abre o anexo.
 */
function pastedName(file: File, index: number): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate(),
  )}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const extension = file.type.split('/')[1]?.split('+')[0] || 'png';
  return `print-${stamp}${index ? `-${index + 1}` : ''}.${extension}`;
}

/**
 * Colar uma imagem em qualquer lugar da pagina vira anexo.
 *
 * Um listener so, no `document`, cobre todos os campos — input, textarea,
 * select e o fundo da pagina. O richtext trata a propria colagem (para a imagem
 * nao entrar no HTML) e marca o evento com `preventDefault`; por isso aqui o
 * evento ja tratado e ignorado, e a imagem nao e anexada duas vezes.
 *
 * Texto colado segue o caminho normal: o evento so e interceptado quando o
 * clipboard traz arquivo de imagem.
 */
export function usePasteAttachments(
  enabled: boolean,
  onFiles: (files: File[]) => void,
) {
  const onFilesRef = React.useRef(onFiles);
  React.useEffect(() => {
    onFilesRef.current = onFiles;
  }, [onFiles]);

  React.useEffect(() => {
    if (!enabled) return;

    const handlePaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented) return;

      const files = Array.from(event.clipboardData?.items ?? [])
        .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file));

      if (!files.length) return;

      event.preventDefault();
      onFilesRef.current(files);
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [enabled]);
}

/** Da nome de print as imagens vindas do clipboard; o resto passa intacto. */
export function renamePasted(files: File[]): File[] {
  return files.map((file, index) =>
    /^image\.\w+$/i.test(file.name) || !file.name
      ? new File([file], pastedName(file, index), { type: file.type })
      : file,
  );
}
