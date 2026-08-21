import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// MediaUploadField only needs useApp().request; mock the provider hook
// directly (vi.hoisted) for full per-test control over resolution/rejection,
// consistent with the pattern used across the repo's hook tests (see
// use-widget-data.test.tsx) rather than wiring the real AppProvider + MSW.
const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));
vi.mock('@hed-hog/next-app-provider', () => ({
  useApp: () => ({ request: mockRequest }),
}));

const { mockToastError } = vi.hoisted(() => ({ mockToastError: vi.fn() }));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: mockToastError,
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}));

const { mockBuildImageUrl, mockBuildFileOpenUrl } = vi.hoisted(() => ({
  mockBuildImageUrl: vi.fn(),
  mockBuildFileOpenUrl: vi.fn(),
}));
vi.mock('@/lib/build-image-url', () => ({
  buildImageUrl: mockBuildImageUrl,
  buildFileOpenUrl: mockBuildFileOpenUrl,
}));

import { MediaUploadField, type MediaUploadLabels } from './media-upload-field';

const labels: MediaUploadLabels = {
  empty: 'empty',
  upload: 'upload',
  replace: 'replace',
  remove: 'remove',
  download: 'download',
  zoom: 'zoom',
  uploading: 'uploading',
  uploadError: 'uploadError',
  downloadError: 'downloadError',
};

function imgFile(name = 'a.png', type = 'image/png') {
  return new File(['x'], name, { type });
}

function getFileInput(container: HTMLElement) {
  return container.querySelector('input[type="file"]') as HTMLInputElement;
}

function getUploadButton(container: HTMLElement) {
  return container
    .querySelector('svg.lucide-cloud-upload')
    ?.closest('button') as HTMLButtonElement;
}

function getRemoveButton(container: HTMLElement) {
  return container
    .querySelector('svg.lucide-trash2')
    ?.closest('button') as HTMLButtonElement;
}

function getZoomButton(container: HTMLElement) {
  return container.querySelector('svg.lucide-eye')?.closest('button') as HTMLButtonElement;
}

describe('MediaUploadField', () => {
  beforeEach(() => {
    mockRequest.mockReset();
    mockToastError.mockReset();
    mockBuildImageUrl.mockReset();
    mockBuildFileOpenUrl.mockReset();
    mockBuildImageUrl.mockReturnValue(null);
    mockBuildFileOpenUrl.mockReturnValue(null);
    vi.restoreAllMocks();
    (URL.createObjectURL as unknown) = vi.fn(() => 'blob:local-url');
    (URL.revokeObjectURL as unknown) = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderField(
    props: Partial<React.ComponentProps<typeof MediaUploadField>> = {}
  ) {
    const onChange = vi.fn();
    const utils = render(
      <MediaUploadField
        kind="image"
        fileId={null}
        onChange={onChange}
        label="Capa"
        destination="courses"
        labels={labels}
        {...props}
      />
    );
    return { ...utils, onChange };
  }

  it('mostra o placeholder vazio quando não há mídia (kind image)', () => {
    renderField();
    expect(screen.getByText('empty')).toBeInTheDocument();
  });

  it('renderiza a descrição quando informada', () => {
    renderField({ description: 'Formato recomendado: 16:9' });
    expect(screen.getByText('Formato recomendado: 16:9')).toBeInTheDocument();
  });

  it('não renderiza parágrafo de descrição quando não informada', () => {
    const { container } = renderField();
    // The description paragraph sits right after the preview box; assert it's absent.
    expect(screen.queryByText(/recomendado/)).not.toBeInTheDocument();
    expect(container.querySelectorAll('p').length).toBe(1); // only the label <p>
  });

  it('mostra o placeholder vazio para vídeo', () => {
    renderField({ kind: 'video' });
    expect(screen.getByText('empty')).toBeInTheDocument();
  });

  it('renderiza a imagem de servidor quando há fileId e nenhum upload local', () => {
    mockBuildImageUrl.mockReturnValue('http://x/file/image/5');
    renderField({ fileId: 5 });
    const img = screen.getByAltText('Capa') as HTMLImageElement;
    expect(img.src).toContain('http://x/file/image/5');
  });

  it('renderiza vídeo quando kind é video e há fileId', () => {
    mockBuildFileOpenUrl.mockReturnValue('http://x/file/open/5');
    const { container } = renderField({ kind: 'video', fileId: 5 });
    const video = container.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute('src', 'http://x/file/open/5');
    // React sets `muted` as a DOM property (not an HTML attribute) to satisfy
    // autoplay policies, so we assert on the property instead of the attribute.
    expect((video as HTMLVideoElement).muted).toBe(true);
    expect(video).toHaveAttribute('loop');
    expect(video).toHaveAttribute('playsinline');
  });

  describe('handleSelect', () => {
    it('aciona o input de arquivo oculto ao clicar no botão de upload', () => {
      const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');
      const { container } = renderField();
      fireEvent.click(getUploadButton(container));
      expect(clickSpy).toHaveBeenCalled();
    });

    it('não faz nada quando nenhum arquivo é selecionado', () => {
      const { container } = renderField();
      fireEvent.change(getFileInput(container), { target: { files: [] } });
      expect(mockRequest).not.toHaveBeenCalled();
    });

    it('exibe erro quando o tipo do arquivo não corresponde ao kind image', () => {
      const { container } = renderField({ kind: 'image' });
      const file = new File(['x'], 'a.mp4', { type: 'video/mp4' });
      fireEvent.change(getFileInput(container), { target: { files: [file] } });
      expect(mockToastError).toHaveBeenCalledWith('uploadError');
      expect(mockRequest).not.toHaveBeenCalled();
    });

    it('exibe erro quando o tipo do arquivo não corresponde ao kind video', () => {
      const { container } = renderField({ kind: 'video' });
      const file = imgFile();
      fireEvent.change(getFileInput(container), { target: { files: [file] } });
      expect(mockToastError).toHaveBeenCalledWith('uploadError');
      expect(mockRequest).not.toHaveBeenCalled();
    });

    it('faz upload com sucesso, atualiza o preview local e chama onChange', async () => {
      mockRequest.mockResolvedValueOnce({ data: { id: 42 } });
      const { container, onChange } = renderField();
      fireEvent.change(getFileInput(container), { target: { files: [imgFile()] } });
      await waitFor(() => expect(onChange).toHaveBeenCalledWith(42));
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/file', method: 'POST' })
      );
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    it('revoga o objectURL local anterior ao enviar um segundo arquivo com sucesso', async () => {
      (URL.createObjectURL as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce('blob:first')
        .mockReturnValueOnce('blob:second');
      mockRequest
        .mockResolvedValueOnce({ data: { id: 1 } })
        .mockResolvedValueOnce({ data: { id: 2 } });
      const { container, onChange } = renderField();
      fireEvent.change(getFileInput(container), { target: { files: [imgFile('first.png')] } });
      await waitFor(() => expect(onChange).toHaveBeenCalledWith(1));

      (URL.revokeObjectURL as ReturnType<typeof vi.fn>).mockClear();
      fireEvent.change(getFileInput(container), { target: { files: [imgFile('second.png')] } });
      await waitFor(() => expect(onChange).toHaveBeenCalledWith(2));
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first');
    });

    it('exibe erro quando a resposta não possui id', async () => {
      mockRequest.mockResolvedValueOnce({ data: {} });
      const { container, onChange } = renderField();
      fireEvent.change(getFileInput(container), { target: { files: [imgFile()] } });
      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith('uploadError')
      );
      expect(onChange).not.toHaveBeenCalled();
    });

    it('exibe erro quando a requisição é rejeitada', async () => {
      mockRequest.mockRejectedValueOnce(new Error('network'));
      const { container, onChange } = renderField();
      fireEvent.change(getFileInput(container), { target: { files: [imgFile()] } });
      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith('uploadError')
      );
      expect(onChange).not.toHaveBeenCalled();
    });

    it('mostra o overlay de upload enquanto a requisição está pendente', async () => {
      let resolveRequest: (value: unknown) => void = () => {};
      mockRequest.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRequest = resolve;
          })
      );
      const { container } = renderField();
      fireEvent.change(getFileInput(container), { target: { files: [imgFile()] } });
      await waitFor(() =>
        expect(
          container.querySelector('.absolute.inset-0 svg.animate-spin')
        ).toBeInTheDocument()
      );
      resolveRequest({ data: { id: 1 } });
      await waitFor(() =>
        expect(
          container.querySelector('.absolute.inset-0 svg.animate-spin')
        ).not.toBeInTheDocument()
      );
    });
  });

  describe('useEffect: reset local preview quando fileId muda', () => {
    it('revoga o objectURL local e volta para a url do servidor quando fileId muda', async () => {
      mockRequest.mockResolvedValueOnce({ data: { id: 42 } });
      mockBuildImageUrl.mockReturnValue('http://x/file/image/99');
      const { container, rerender, onChange } = renderField({ fileId: null });
      fireEvent.change(getFileInput(container), { target: { files: [imgFile()] } });
      await waitFor(() => expect(onChange).toHaveBeenCalledWith(42));

      (URL.revokeObjectURL as ReturnType<typeof vi.fn>).mockClear();
      rerender(
        <MediaUploadField
          kind="image"
          fileId={99}
          onChange={onChange}
          label="Capa"
          destination="courses"
          labels={labels}
        />
      );
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-url');
      const img = screen.getByAltText('Capa') as HTMLImageElement;
      expect(img.src).toContain('http://x/file/image/99');
    });
  });

  describe('cleanup no unmount', () => {
    // The unmount cleanup effect now depends on `localUrl`, so its closure is
    // refreshed every time `localUrl` changes and always captures the latest
    // value — fixing a memory leak where the previous empty-dependency-array
    // version only ever saw `localUrl` from the very first render (always
    // null) and therefore never revoked the real object URL on unmount.
    it('revoga o objectURL local mais recente ao desmontar (sem closure obsoleta)', async () => {
      (URL.createObjectURL as ReturnType<typeof vi.fn>).mockReturnValue(
        'blob:latest-url'
      );
      mockRequest.mockResolvedValueOnce({ data: { id: 42 } });
      const { container, unmount, onChange } = renderField();
      fireEvent.change(getFileInput(container), { target: { files: [imgFile()] } });
      await waitFor(() => expect(onChange).toHaveBeenCalledWith(42));
      (URL.revokeObjectURL as ReturnType<typeof vi.fn>).mockClear();
      unmount();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:latest-url');
      expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(null);
    });
  });

  describe('handleRemove', () => {
    it('revoga o objectURL local (se existir) e chama onChange(null)', async () => {
      mockRequest.mockResolvedValueOnce({ data: { id: 42 } });
      const { container, onChange } = renderField({ fileId: 5 });
      fireEvent.change(getFileInput(container), { target: { files: [imgFile()] } });
      await waitFor(() => expect(onChange).toHaveBeenCalledWith(42));

      (URL.revokeObjectURL as ReturnType<typeof vi.fn>).mockClear();
      fireEvent.click(getRemoveButton(container));
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-url');
      expect(onChange).toHaveBeenCalledWith(null);
    });

    it('chama onChange(null) mesmo sem preview local', () => {
      const { container, onChange } = renderField({ fileId: 5 });
      fireEvent.click(getRemoveButton(container));
      expect(onChange).toHaveBeenCalledWith(null);
    });
  });

  describe('handleDownload', () => {
    beforeEach(() => {
      (global.fetch as unknown) = vi.fn();
    });

    it('não faz nada quando buildFileOpenUrl retorna falsy mesmo com mídia presente', async () => {
      // hasMedia only depends on `fileId` being truthy, not on buildFileOpenUrl,
      // so this branch IS reachable: kind="image" uses buildImageUrl for the
      // preview (independently mocked to return a url, so the zoom/download UI
      // renders) while buildFileOpenUrl (used only by handleDownload) returns
      // null, hitting the `if (!url) return;` early-return branch.
      mockBuildImageUrl.mockReturnValue('http://x/file/image/5');
      mockBuildFileOpenUrl.mockReturnValue(null);
      const { container } = renderField({ fileId: 5 });
      fireEvent.click(getZoomButton(container));
      const downloadBtn = screen.getByText('download').closest('button') as HTMLButtonElement;
      fireEvent.click(downloadBtn);
      await Promise.resolve();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('baixa o arquivo com o nome informado e a extensão correta (downloadName definido)', async () => {
      mockBuildFileOpenUrl.mockReturnValue('http://x/file/open/5');
      const blob = new Blob(['x'], { type: 'image/png' });
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        blob: () => Promise.resolve(blob),
      });
      const clickSpy = vi.fn();
      const appendSpy = vi.spyOn(document.body, 'appendChild');
      const { container } = renderField({ fileId: 5, downloadName: 'thumbnail' });

      fireEvent.click(getZoomButton(container));
      const downloadBtn = screen.getByText('download').closest('button') as HTMLButtonElement;

      let capturedAnchor: HTMLAnchorElement | null = null;
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') {
          capturedAnchor = el as HTMLAnchorElement;
          el.click = clickSpy;
        }
        return el;
      });

      fireEvent.click(downloadBtn);
      await waitFor(() => expect(clickSpy).toHaveBeenCalled());
      expect(global.fetch).toHaveBeenCalledWith('http://x/file/open/5');
      expect(capturedAnchor).not.toBeNull();
      expect(capturedAnchor!.download).toBe('thumbnail.png');
      expect(appendSpy).toHaveBeenCalled();
    });

    it('usa o nome padrão "media" quando downloadName não é informado', async () => {
      mockBuildFileOpenUrl.mockReturnValue('http://x/file/open/5');
      const blob = new Blob(['x'], { type: 'video/mp4' });
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        blob: () => Promise.resolve(blob),
      });
      const { container } = renderField({ kind: 'video', fileId: 5 });
      fireEvent.click(getZoomButton(container));
      const downloadBtn = screen.getByText('download').closest('button') as HTMLButtonElement;

      let capturedAnchor: HTMLAnchorElement | null = null;
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') {
          capturedAnchor = el as HTMLAnchorElement;
          el.click = vi.fn();
        }
        return el;
      });

      fireEvent.click(downloadBtn);
      await waitFor(() => expect(capturedAnchor).not.toBeNull());
      expect(capturedAnchor!.download).toBe('media.mp4');
    });

    it('usa a extensão fallback quando o mime type é desconhecido', async () => {
      mockBuildFileOpenUrl.mockReturnValue('http://x/file/open/5');
      const blob = new Blob(['x'], { type: 'application/octet-stream' });
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        blob: () => Promise.resolve(blob),
      });
      const { container } = renderField({ fileId: 5 });
      fireEvent.click(getZoomButton(container));
      const downloadBtn = screen.getByText('download').closest('button') as HTMLButtonElement;

      let capturedAnchor: HTMLAnchorElement | null = null;
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') {
          capturedAnchor = el as HTMLAnchorElement;
          el.click = vi.fn();
        }
        return el;
      });

      fireEvent.click(downloadBtn);
      // Fallback ext depends on `kind` ('png' for image).
      await waitFor(() => expect(capturedAnchor).not.toBeNull());
      expect(capturedAnchor!.download).toBe('media.png');
    });

    it('usa a extensão fallback "mp4" para vídeo quando o mime type é desconhecido', async () => {
      mockBuildFileOpenUrl.mockReturnValue('http://x/file/open/5');
      const blob = new Blob(['x'], { type: 'application/octet-stream' });
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        blob: () => Promise.resolve(blob),
      });
      const { container } = renderField({ kind: 'video', fileId: 5 });
      fireEvent.click(getZoomButton(container));
      const downloadBtn = screen.getByText('download').closest('button') as HTMLButtonElement;

      let capturedAnchor: HTMLAnchorElement | null = null;
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') {
          capturedAnchor = el as HTMLAnchorElement;
          el.click = vi.fn();
        }
        return el;
      });

      fireEvent.click(downloadBtn);
      await waitFor(() => expect(capturedAnchor).not.toBeNull());
      expect(capturedAnchor!.download).toBe('media.mp4');
    });

    it('exibe erro quando o fetch é rejeitado', async () => {
      mockBuildFileOpenUrl.mockReturnValue('http://x/file/open/5');
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
      const { container } = renderField({ fileId: 5 });
      fireEvent.click(getZoomButton(container));
      const downloadBtn = screen.getByText('download').closest('button') as HTMLButtonElement;
      fireEvent.click(downloadBtn);
      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith('downloadError')
      );
    });
  });

  describe('disabled', () => {
    it('desabilita os botões de upload e remoção quando disabled=true', () => {
      const { container } = renderField({ fileId: 5, disabled: true });
      expect(getUploadButton(container)).toBeDisabled();
      expect(getRemoveButton(container)).toBeDisabled();
    });
  });

  describe('dialog de zoom', () => {
    it('não renderiza o gatilho de zoom quando não há mídia', () => {
      const { container } = renderField({ fileId: null });
      expect(getZoomButton(container)).toBeUndefined();
    });

    it('renderiza a imagem em tamanho grande dentro do dialog para kind image', () => {
      mockBuildImageUrl.mockReturnValue('http://x/file/image/5');
      const { container } = renderField({ fileId: 5 });
      fireEvent.click(getZoomButton(container));
      const dialogImages = screen.getAllByAltText('Capa');
      expect(dialogImages.length).toBeGreaterThanOrEqual(2);
    });

    it('renderiza o vídeo dentro do dialog para kind video', () => {
      mockBuildFileOpenUrl.mockReturnValue('http://x/file/open/5');
      const { container } = renderField({ kind: 'video', fileId: 5 });
      fireEvent.click(getZoomButton(container));
      // Radix Dialog renders its content in a portal appended to
      // document.body, outside of `container`, so query the whole document.
      const videos = document.querySelectorAll('video');
      expect(videos.length).toBeGreaterThanOrEqual(2);
    });
  });
});
